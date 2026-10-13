import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("=================================================");
  console.log("   BotPayEscrow — BOT Chain Mainnet Deployment   ");
  console.log("=================================================");

  const expectedChainId = 677n;
  const network = await ethers.provider.getNetwork();
  console.log(`Connected to Chain ID: ${network.chainId.toString()}`);

  if (network.chainId !== expectedChainId) {
    throw new Error(`CRITICAL: Deployment aborted. Expected Chain ID 677, got ${network.chainId}`);
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} BOT`);

  const feeData = await ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice || ethers.parseUnits("20", "gwei");
  console.log(`Network Gas Price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);

  // Factory & bytecode check
  const EscrowFactory = await ethers.getContractFactory("BotPayEscrow");
  const deployTx = await EscrowFactory.getDeployTransaction();
  const estimatedGas = await ethers.provider.estimateGas(deployTx);
  console.log(`Estimated deployment gas: ${estimatedGas.toString()}`);

  const totalCost = estimatedGas * gasPrice;
  console.log(`Estimated deployment cost: ${ethers.formatEther(totalCost)} BOT`);

  if (balance < totalCost) {
    throw new Error(`CRITICAL: Insufficient BOT balance for deployment. Required: ${ethers.formatEther(totalCost)} BOT, Available: ${ethers.formatEther(balance)} BOT`);
  }

  console.log("Broadcasting deployment transaction to BOT Chain Mainnet...");
  const escrow = await EscrowFactory.deploy();
  console.log(`Transaction submitted with hash: ${escrow.deploymentTransaction()?.hash}`);

  console.log("Waiting for block confirmation...");
  const receipt = await escrow.deploymentTransaction()?.wait(1);
  if (!receipt) {
    throw new Error("Failed to obtain transaction receipt.");
  }

  const contractAddress = await escrow.getAddress();
  console.log("=================================================");
  console.log(">>> CONTRACT SUCCESSFULLY DEPLOYED TO MAINNET <<<");
  console.log(`Contract Name:            BotPayEscrow`);
  console.log(`Contract Address:         ${contractAddress}`);
  console.log(`Transaction Hash:         ${receipt.hash}`);
  console.log(`Block Number:             ${receipt.blockNumber}`);
  console.log(`Gas Used:                 ${receipt.gasUsed.toString()}`);
  console.log(`Effective Gas Price:      ${ethers.formatUnits(receipt.gasPrice, "gwei")} gwei`);
  console.log(`Explorer Contract Link:   https://scan.botchain.ai/address/${contractAddress}`);
  console.log(`Explorer Tx Link:         https://scan.botchain.ai/tx/${receipt.hash}`);
  console.log("=================================================");

  // Verify bytecode on-chain
  const deployedBytecode = await ethers.provider.getCode(contractAddress);
  if (!deployedBytecode || deployedBytecode === "0x") {
    throw new Error("CRITICAL: Deployed address has no bytecode on-chain!");
  }
  console.log(`Bytecode verification: Verified (${deployedBytecode.length / 2 - 1} bytes on-chain).`);

  // Read-only state check
  const count = await escrow.agreementCount();
  console.log(`Initial agreementCount on mainnet: ${count.toString()}`);

  // Save deployment artifact manifest
  const deploymentManifest = {
    contractName: "BotPayEscrow",
    network: "BOT Chain Mainnet",
    chainId: 677,
    rpc: "https://rpc.botchain.ai",
    explorer: "https://scan.botchain.ai",
    contractAddress: contractAddress,
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    deployer: deployer.address,
    gasUsed: receipt.gasUsed.toString(),
    effectiveGasPrice: ethers.formatUnits(receipt.gasPrice, "gwei") + " gwei",
    timestamp: new Date().toISOString(),
    compiler: {
      version: "0.8.24",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  };

  const manifestPath = path.join(__dirname, "../deployment-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(deploymentManifest, null, 2));
  console.log(`Deployment manifest written to ${manifestPath}`);

  // Write contract address & ABI to frontend src directory
  const frontendConfigDir = path.join(__dirname, "../Botpay Frontend/src/contracts");
  if (!fs.existsSync(frontendConfigDir)) {
    fs.mkdirSync(frontendConfigDir, { recursive: true });
  }

  const contractArtifact = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../artifacts/contracts/BotPayEscrow.sol/BotPayEscrow.json"), "utf8")
  );

  const frontendContractConfig = {
    address: contractAddress,
    chainId: 677,
    networkName: "BOT Chain Mainnet",
    rpcUrl: "https://rpc.botchain.ai",
    explorerUrl: "https://scan.botchain.ai",
    abi: contractArtifact.abi,
  };

  fs.writeFileSync(
    path.join(frontendConfigDir, "BotPayEscrow.json"),
    JSON.stringify(frontendContractConfig, null, 2)
  );
  console.log(`Frontend contract configuration written to Botpay Frontend/src/contracts/BotPayEscrow.json`);
}

main().catch((err) => {
  console.error("Mainnet deployment failed:", err);
  process.exit(1);
});
