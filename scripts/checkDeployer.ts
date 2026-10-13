import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("=================================================");
  console.log("       BOT Chain Mainnet Pre-Flight Check        ");
  console.log("=================================================");

  const rpcUrl = "https://rpc.botchain.ai";
  const expectedChainId = 677;

  console.log(`Connecting to RPC: ${rpcUrl}`);
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  console.log(`Reported Network Chain ID: ${chainId}`);

  if (chainId !== expectedChainId) {
    console.error(`ERROR: Chain ID mismatch! Expected ${expectedChainId}, got ${chainId}`);
    process.exit(1);
  }
  console.log("SUCCESS: Chain ID matches BOT Chain Mainnet (677).");

  const privateKey = process.env.DEPLOYER_PRIVATE_KEY?.trim();
  if (!privateKey) {
    console.error("ERROR: DEPLOYER_PRIVATE_KEY is not defined in .env");
    process.exit(1);
  }

  const formattedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const wallet = new ethers.Wallet(formattedKey, provider);
  console.log(`Deployer Address: ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer Balance: ${ethers.formatEther(balance)} BOT (${balance.toString()} wei)`);

  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice || ethers.parseUnits("1", "gwei");
  console.log(`Current Gas Price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);

  // Deployment gas requirement estimate (approx 915,714 + buffer = 1,100,000 gas)
  const estimatedGas = 1100000n;
  const estimatedCost = estimatedGas * gasPrice;
  console.log(`Estimated Deployment Cost: ${ethers.formatEther(estimatedCost)} BOT`);

  if (balance < estimatedCost) {
    console.log("STATUS: Deployer has INSUFFICIENT BOT for mainnet broadcast.");
    console.log(`Required: ~${ethers.formatEther(estimatedCost)} BOT, Available: ${ethers.formatEther(balance)} BOT`);
  } else {
    console.log("STATUS: Deployer has SUFFICIENT BOT for mainnet broadcast.");
  }
  console.log("=================================================");
}

main().catch((err) => {
  console.error("Pre-flight check failed:", err.message);
  process.exit(1);
});
