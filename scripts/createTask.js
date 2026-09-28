const { ethers } = require("hardhat");

async function main() {
  console.log("==================================================");
  console.log("MST Testnet Interaction: Create Task T001");
  console.log("==================================================");

  const contractAddress =
    process.env.PROOF_TO_PAY_CONTRACT_ADDRESS || process.env.MST_CONTRACT_ADDRESS;

  if (!contractAddress) {
    throw new Error(
      "Contract address not found. Please set PROOF_TO_PAY_CONTRACT_ADDRESS or MST_CONTRACT_ADDRESS in .env"
    );
  }

  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  console.log(`Caller Address:    ${signerAddress}`);
  console.log(`Contract Address:  ${contractAddress}`);

  const ProofToPay = await ethers.getContractFactory("ProofToPay");
  const proofToPay = ProofToPay.attach(contractAddress);

  const taskId = "T001";
  const reward = ethers.parseEther("100"); // 100 MSTC reward
  const packageId = "P01";
  const source = "Zone A";
  const destination = "Zone B";

  console.log(`\nSubmitting createTask("${taskId}", 100 MSTC, "${packageId}", "${source}", "${destination}")...`);
  const tx = await proofToPay.connect(signer).createTask(
    taskId,
    reward,
    packageId,
    source,
    destination
  );

  console.log(`Transaction submitted! Hash: ${tx.hash}`);
  console.log("Waiting for block confirmation...");
  const receipt = await tx.wait();

  console.log("\n==================================================");
  console.log("TRANSACTION CONFIRMED ON MST TESTNET!");
  console.log("==================================================");
  console.log(`TASK_CREATION_TX=${receipt.hash}`);
  console.log(`Block Number:     ${receipt.blockNumber}`);
  console.log(`Gas Used:         ${receipt.gasUsed.toString()}`);
  console.log(`MSTSCAN_TX_URL=https://testnet.mstscan.com/tx/${receipt.hash}`);
  console.log("==================================================");
}

main().catch((error) => {
  console.error("Task creation failed:", error);
  process.exitCode = 1;
});
