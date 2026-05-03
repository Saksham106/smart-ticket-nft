const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BaselineTicketNFT", function () {
  const NAME = "Baseline Ticket";
  const SYMBOL = "BTIX";
  const MAX_SUPPLY = 3;
  const PRIMARY_PRICE = ethers.parseEther("0.05");

  let owner;
  let alice;
  let bob;
  let scalper;
  let contract;

  beforeEach(async function () {
    [owner, alice, bob, scalper] = await ethers.getSigners();

    const BaselineTicketNFT = await ethers.getContractFactory("BaselineTicketNFT");
    contract = await BaselineTicketNFT.deploy(NAME, SYMBOL, MAX_SUPPLY, PRIMARY_PRICE);
    await contract.waitForDeployment();
  });

  describe("same as capped contract", function () {
    it("organizer can mint tickets", async function () {
      await contract.mintTo(alice.address);
      expect(await contract.ownerOf(1)).to.equal(alice.address);
    });

    it("non-organizer cannot mint tickets", async function () {
      await expect(
        contract.connect(alice).mintTo(alice.address)
      ).to.be.revertedWithCustomError(contract, "NotOrganizer");
    });

    it("a user can buy a ticket", async function () {
      await contract.connect(alice).buyTicket({ value: PRIMARY_PRICE });
      expect(await contract.ownerOf(1)).to.equal(alice.address);
    });

    it("incorrect primary payment reverts", async function () {
      await expect(
        contract.connect(alice).buyTicket({ value: ethers.parseEther("0.01") })
      ).to.be.revertedWithCustomError(contract, "IncorrectPayment");
    });

    it("organizer can redeem a ticket", async function () {
      await contract.connect(alice).buyTicket({ value: PRIMARY_PRICE });
      await contract.redeem(1);
      expect(await contract.isRedeemed(1)).to.equal(true);
    });

    it("redeeming the same ticket twice reverts", async function () {
      await contract.connect(alice).buyTicket({ value: PRIMARY_PRICE });
      await contract.redeem(1);
      await expect(contract.redeem(1)).to.be.revertedWithCustomError(
        contract,
        "AlreadyRedeemed"
      );
    });

    it("redeem unminted token id reverts", async function () {
      await contract.connect(alice).buyTicket({ value: PRIMARY_PRICE });
      await expect(contract.redeem(2)).to.be.revertedWithCustomError(
        contract,
        "InvalidTicket"
      );
    });

    it("redeem token id zero reverts", async function () {
      await expect(contract.redeem(0)).to.be.revertedWithCustomError(
        contract,
        "InvalidTicket"
      );
    });
  });

  describe("things the baseline can't enforce", function () {
    it("holder can transfer the ticket directly with no listing or cap", async function () {
      await contract.connect(alice).buyTicket({ value: PRIMARY_PRICE });

      await contract.connect(alice).transferFrom(alice.address, bob.address, 1);
      expect(await contract.ownerOf(1)).to.equal(bob.address);
    });

    it("a scalper can buy multiple tickets and resell at any off-chain price", async function () {
      await contract.connect(scalper).buyTicket({ value: PRIMARY_PRICE });
      await contract.connect(scalper).buyTicket({ value: PRIMARY_PRICE });
      await contract.connect(scalper).buyTicket({ value: PRIMARY_PRICE });
      expect(await contract.totalMinted()).to.equal(3);

      const tenX = PRIMARY_PRICE * 10n;
      const before = await ethers.provider.getBalance(scalper.address);
      await alice.sendTransaction({ to: scalper.address, value: tenX });

      await contract.connect(scalper).transferFrom(scalper.address, alice.address, 1);
      expect(await contract.ownerOf(1)).to.equal(alice.address);

      const after = await ethers.provider.getBalance(scalper.address);
      expect(after - before).to.be.greaterThan(PRIMARY_PRICE * 8n);
    });

    it("buyer can pay off-chain but seller never has to transfer", async function () {
      await contract.connect(scalper).buyTicket({ value: PRIMARY_PRICE });

      const price = PRIMARY_PRICE * 5n;
      await alice.sendTransaction({ to: scalper.address, value: price });

      expect(await contract.ownerOf(1)).to.equal(scalper.address);
      expect(contract.interface.fragments.some((f) => f.name === "buyResale")).to.equal(
        false
      );
    });
  });
});
