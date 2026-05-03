const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EventTicketNFT", function () {
  const NAME = "Event Ticket";
  const SYMBOL = "TIX";
  const MAX_SUPPLY = 3;
  const PRIMARY_PRICE = ethers.parseEther("0.05");
  const RESALE_CAP = ethers.parseEther("0.08");

  let owner;
  let alice;
  let bob;
  let contract;

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const EventTicketNFT = await ethers.getContractFactory("EventTicketNFT");
    contract = await EventTicketNFT.deploy(
      NAME,
      SYMBOL,
      MAX_SUPPLY,
      PRIMARY_PRICE,
      RESALE_CAP
    );
    await contract.waitForDeployment();
  });

  it("organizer can mint tickets", async function () {
    await contract.mintTo(alice.address);
    expect(await contract.ownerOf(1)).to.equal(alice.address);
  });

  it("non-organizer cannot mint tickets", async function () {
    await expect(contract.connect(alice).mintTo(alice.address)).to.be.revertedWithCustomError(
      contract,
      "NotOrganizer"
    );
  });

  it("a user can buy a ticket", async function () {
    await contract.connect(alice).buyTicket({ value: PRIMARY_PRICE });
    expect(await contract.ownerOf(1)).to.equal(alice.address);
  });

  it("a user can list a ticket for resale under the cap", async function () {
    await contract.connect(alice).buyTicket({ value: PRIMARY_PRICE });
    await contract.connect(alice).listForResale(1, PRIMARY_PRICE);

    const listing = await contract.getListing(1);
    expect(listing.active).to.equal(true);
    expect(listing.price).to.equal(PRIMARY_PRICE);
  });

  it("a resale above the cap reverts", async function () {
    await contract.connect(alice).buyTicket({ value: PRIMARY_PRICE });

    await expect(
      contract.connect(alice).listForResale(1, ethers.parseEther("0.09"))
    ).to.be.revertedWithCustomError(contract, "ResalePriceTooHigh");
  });

  it("a buyer can purchase a listed resale ticket", async function () {
    await contract.connect(alice).buyTicket({ value: PRIMARY_PRICE });
    await contract.connect(alice).listForResale(1, PRIMARY_PRICE);

    await contract.connect(bob).buyResale(1, { value: PRIMARY_PRICE });
    expect(await contract.ownerOf(1)).to.equal(bob.address);

    const listing = await contract.getListing(1);
    expect(listing.active).to.equal(false);
  });

  it("direct unauthorized transfer is blocked", async function () {
    await contract.connect(alice).buyTicket({ value: PRIMARY_PRICE });

    await expect(
      contract.connect(alice).transferFrom(alice.address, bob.address, 1)
    ).to.be.revertedWithCustomError(contract, "TransferNotAllowed");
  });

  it("organizer can redeem a ticket", async function () {
    await contract.connect(alice).buyTicket({ value: PRIMARY_PRICE });

    await contract.redeem(1);
    expect(await contract.isRedeemed(1)).to.equal(true);
  });

  it("redeeming the same ticket twice reverts", async function () {
    await contract.connect(alice).buyTicket({ value: PRIMARY_PRICE });

    await contract.redeem(1);
    await expect(contract.redeem(1)).to.be.revertedWithCustomError(contract, "AlreadyRedeemed");
  });

  it("redeem unminted token id reverts", async function () {
    await contract.connect(alice).buyTicket({ value: PRIMARY_PRICE });

    await expect(contract.redeem(2)).to.be.revertedWithCustomError(contract, "InvalidTicket");
  });

  it("redeem token id zero reverts", async function () {
    await expect(contract.redeem(0)).to.be.revertedWithCustomError(contract, "InvalidTicket");
  });
});
