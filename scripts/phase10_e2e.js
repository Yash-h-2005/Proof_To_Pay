const dotenv = require('dotenv');
const { ethers } = require('ethers');
const path = require('path');
const { execSync } = require('child_process');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MST_RPC_URL = process.env.MST_RPC_URL;
const MST_PRIVATE_KEY = process.env.MST_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.PROOF_TO_PAY_CONTRACT_ADDRESS;

const PROOF_TO_PAY_ABI = [
  "function createTask(string calldata taskId, uint256 reward, string calldata packageId, string calldata source, string calldata destination) external",
  "function fundTask(string calldata taskId) external payable",
  "function assignRobot(string calldata taskId, address robot) external",
  "function startTask(string calldata taskId) external",
  "function submitProof(string calldata taskId, bytes32 proofHash) external",
  "function verifyTask(string calldata taskId, bool success) external",
  "function releasePayment(string calldata taskId) external",
  "function getTask(string calldata taskId) external view returns (tuple(string taskId, address creator, address robot, uint256 reward, string packageId, string source, string destination, bytes32 proofHash, uint8 state, uint256 createdAt, uint256 proofSubmittedAt, uint256 verifiedAt))"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(MST_RPC_URL);
  const wallet = new ethers.Wallet(MST_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, PROOF_TO_PAY_ABI, wallet);

  const TASK_ID = "T003";
  const REWARD_MSTC = "1";
  const REWARD_WEI = ethers.parseEther(REWARD_MSTC);
  const PACKAGE_ID = "P03";
  const SOURCE = "Zone A";
  const DESTINATION = "Zone B";

  console.log("==================================================");
  console.log("PHASE 10 END-TO-END LIFECYCLE FOR T003");
  console.log("==================================================");

  const stateLabels = ["CREATED", "FUNDED", "ASSIGNED", "WORKING", "PROOF_SUBMITTED", "VERIFIED", "PAID", "REFUNDED"];

  async function checkState(step, expectedState) {
    const task = await contract.getTask(TASK_ID);
    const stateStr = stateLabels[task.state];
    console.log(`[${step}] Task State: ${stateStr}`);
    if (stateStr !== expectedState) {
      throw new Error(`Expected state ${expectedState}, got ${stateStr}`);
    }
  }

  try {
    await contract.getTask(TASK_ID);
    console.log("T003 already exists. We will proceed depending on its state.");
  } catch (err) {
    if (err.message.includes("Task does not exist") || err.message.includes("revert")) {
      console.log(`\nSTEP 1: Create Task ${TASK_ID}`);
      const txCreate = await contract.createTask(TASK_ID, REWARD_WEI, PACKAGE_ID, SOURCE, DESTINATION);
      console.log(`CREATE TX HASH: ${txCreate.hash}`);
      await txCreate.wait();
      await checkState("Create", "CREATED");
    } else {
      throw err;
    }
  }

  const taskCurrent = await contract.getTask(TASK_ID);
  let currentState = Number(taskCurrent.state);

  if (currentState === 0) { 
    console.log(`\nSTEP 2: Fund Task ${TASK_ID}`);
    const txFund = await contract.fundTask(TASK_ID, { value: REWARD_WEI });
    console.log(`FUND TX HASH: ${txFund.hash}`);
    await txFund.wait();
    await checkState("Fund", "FUNDED");
    currentState = 1;
  }

  if (currentState === 1) { 
    console.log("\nSTEP 3: Assign Robot");
    const txAssign = await contract.assignRobot(TASK_ID, wallet.address);
    console.log(`ASSIGN TX HASH: ${txAssign.hash}`);
    await txAssign.wait();
    await checkState("Assign", "ASSIGNED");
    currentState = 2;
  }

  if (currentState === 2) { 
    console.log("\nSTEP 4: Start Task");
    const txStart = await contract.startTask(TASK_ID);
    console.log(`START TX HASH: ${txStart.hash}`);
    await txStart.wait();
    await checkState("Start", "WORKING");
    currentState = 3;
  }

  if (currentState === 3) {
    console.log(`\nSTEP 5: Run Robot Simulator (Generating simulated proof for ${TASK_ID})`);
    const simulatorOutput = execSync(`npm run simulate -- ${TASK_ID}`, { cwd: path.resolve(__dirname, '../robot/simulator'), encoding: 'utf-8' });
    console.log(simulatorOutput);

    // Fetch proofHash from backend
    const response = await fetch(`http://localhost:3001/api/tasks/${TASK_ID}`);
    const data = await response.json();
    let proofHash = data.data.proofHash;
    if (!proofHash || proofHash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      console.log("Fetching local evidence hash because task endpoint hash is empty...");
      const evRes = await fetch(`http://localhost:3001/api/tasks/${TASK_ID}/evidence`);
      const evData = await evRes.json();
      
      const canonical = {
          taskId: evData.data.taskId,
          robotId: evData.data.robotId,
          packageId: evData.data.packageId,
          source: evData.data.source,
          destination: evData.data.destination,
          timestamp: evData.data.timestamp,
          rfidUid: evData.data.rfidUid,
          distance: evData.data.distance,
          simulation: evData.data.simulation // backend uses it?
      };
      
      // We need to mirror what backend generated. 
      // Actually backend generated it inside /proof endpoint. Let's look at simulator output.
      const match = simulatorOutput.match(/Proof Hash:\s*(0x[a-fA-F0-9]{64})/);
      if (match) {
         proofHash = match[1];
      } else {
         throw new Error("Could not extract proof hash from simulator output");
      }
    }
    
    console.log(`\nSTEP 6: Submit Proof on-chain (Proof Hash: ${proofHash})`);
    const txProof = await contract.submitProof(TASK_ID, proofHash);
    console.log(`PROOF TX HASH: ${txProof.hash}`);
    await txProof.wait();
    await checkState("SubmitProof", "PROOF_SUBMITTED");
    currentState = 4;
  }

  if (currentState === 4) {
    console.log("\nSTEP 7: Independent Verifier checks");
    const verifierOutput = execSync(`npm run verify -- ${TASK_ID}`, { cwd: path.resolve(__dirname, '../verifier'), encoding: 'utf-8' });
    console.log(verifierOutput);

    if (verifierOutput.includes("VERIFICATION RESULT: VERIFIED")) {
       console.log("\nSTEP 8: On-Chain Verification");
       const txVerify = await contract.verifyTask(TASK_ID, true);
       console.log(`VERIFY TX HASH: ${txVerify.hash}`);
       await txVerify.wait();
       await checkState("Verify", "VERIFIED");
       currentState = 5;
    } else {
       throw new Error("Verifier failed the task.");
    }
  }

  if (currentState === 5) { 
    const balanceBefore = await provider.getBalance(wallet.address);
    console.log(`\nBalance before release: ${ethers.formatEther(balanceBefore)} MSTC`);

    console.log("STEP 9: Release Payment");
    const txRelease = await contract.releasePayment(TASK_ID);
    console.log(`PAYMENT TX HASH: ${txRelease.hash}`);
    const receipt = await txRelease.wait();
    await checkState("Release", "PAID");

    const balanceAfter = await provider.getBalance(wallet.address);
    console.log(`Balance after release: ${ethers.formatEther(balanceAfter)} MSTC`);
    
    const gasUsed = BigInt(receipt.gasUsed) * BigInt(receipt.gasPrice);
    const diff = balanceAfter - balanceBefore;
    console.log(`Difference (incl gas): ${ethers.formatEther(diff)} MSTC`);
    console.log(`Expected (1 MSTC - gas): ${ethers.formatEther(REWARD_WEI - gasUsed)} MSTC`);
  }

  console.log("\nEND-TO-END LIFECYCLE COMPLETE");
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
