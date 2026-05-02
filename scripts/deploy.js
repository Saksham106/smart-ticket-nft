const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const EventTicketNFT = await hre.ethers.getContractFactory("EventTicketNFT");
  const contract = await EventTicketNFT.deploy(
    "Event Ticket",
    "TIX",
    100,
    hre.ethers.parseEther("0.05"),
    hre.ethers.parseEther("0.08")
  );

  await contract.waitForDeployment();

  console.log("Deployer:", deployer.address);
  console.log("EventTicketNFT:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
