const { ethers, network } = require("hardhat");

async function main() {
  console.log("==================================================");
  console.log("MST Testnet Deployment: ProofToPay Smart Contract");
  console.log("==================================================");

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No deployer signer found. Please ensure MST_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY is set in your local .env file."
    );
  }

  const deployerAddress = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);
  const networkInfo = await ethers.provider.getNetwork();

  console.log(`Connected Network Name: ${network.name}`);
  console.log(`Connected Chain ID:     ${networkInfo.chainId.toString()}`);
  console.log(`Deployer Public Address: ${deployerAddress}`);
  console.log(`Deployer Balance:        ${ethers.formatEther(balance)} tMSTC`);

  if (balance === 0n) {
    throw new Error(
      `Deployer account ${deployerAddress} has 0 tMSTC. Please fund this account via the MST Testnet Faucet before deploying.`
    );
  }

  // Designated verifier: check VERIFIER_PUBLIC_KEY in .env, otherwise use deployer for initial MVP
  const verifierAddress = process.env.VERIFIER_PUBLIC_KEY || deployerAddress;
  console.log(`Designated Initial Verifier: ${verifierAddress}`);
  if (verifierAddress.toLowerCase() === deployerAddress.toLowerCase()) {
    console.log(
      "Notice: Initial verifier set to deployer address for bootstrap testing. Use setVerifier() to assign an independent verification node."
    );
  }

  console.log("\nDeploying ProofToPay contract...");
  const ProofToPayFactory = await ethers.getContractFactory("ProofToPay");
  const proofToPay = await ProofToPayFactory.deploy(verifierAddress);

  console.log("Waiting for deployment transaction confirmation...");
  await proofToPay.waitForDeployment();

  const contractAddress = await proofToPay.getAddress();
  const deploymentTx = proofToPay.deploymentTransaction();
  const txHash = deploymentTx ? deploymentTx.hash : "N/A";

  console.log("\n==================================================");
  console.log("DEPLOYMENT SUCCESSFUL!");
  console.log("==================================================");
  console.log(`MST_CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`MST_DEPLOYMENT_TX=${txHash}`);
  console.log(`MSTSCAN_CONTRACT_URL=https://testnet.mstscan.com/address/${contractAddress}`);
  console.log(`MSTSCAN_TX_URL=https://testnet.mstscan.com/tx/${txHash}`);
  console.log("==================================================");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
