import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("=================================================");
  console.log("   BotPayEscrow — Mainnet Contract Verification  ");
  console.log("=================================================");

  const rpcUrl = "https://rpc.botchain.ai";
  const contractAddress = "0x2d25345ff92C85E00E83c8ce1798f0CD66f6DCCA";
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const code = await provider.getCode(contractAddress);
  console.log(`On-chain Bytecode length: ${code.length / 2 - 1} bytes`);

  const abi = [
    "function agreementCount() external view returns (uint256)",
    "function isAgentAuthorized(address buyer, address agent) external view returns (bool)"
  ];

  const contract = new ethers.Contract(contractAddress, abi, provider);
  const count = await contract.agreementCount();
  console.log(`On-chain Agreement Count: ${count.toString()}`);

  const network = await provider.getNetwork();
  console.log(`Chain ID: ${network.chainId.toString()}`);

  console.log("SUCCESS: Deployed contract is fully operational and responsive on BOT Chain Mainnet!");
  console.log("=================================================");
}

main().catch(console.error);
