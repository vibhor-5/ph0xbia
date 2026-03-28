import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🏚️  Deploying PH0xBIA with account:", deployer.address);
  console.log("   Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON");

  const treasuryAddress = process.env.TREASURY_ADDRESS;
  const signerAddress = process.env.SIGNER_ADDRESS; // The Warden's public address (not private key)

  if (!treasuryAddress || !signerAddress) {
    throw new Error(
      "Missing env vars: TREASURY_ADDRESS and SIGNER_ADDRESS required.\n" +
      "SIGNER_ADDRESS = public address of The Warden (derived from SIGNER_PRIVATE_KEY)"
    );
  }

  console.log("   Treasury (Asylum Vault):", treasuryAddress);
  console.log("   Trusted Signer (The Warden):", signerAddress);

  const PH0xBIA = await ethers.getContractFactory("PH0xBIA");
  const contract = await PH0xBIA.deploy(treasuryAddress, signerAddress);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\n✅ PH0xBIA deployed to:", address);
  console.log("   Set NEXT_PUBLIC_CONTRACT_ADDRESS=" + address + " in .env.local");
  console.log("\n🔍 Verify on explorer: https://testnet.monadscan.com/address/" + address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
