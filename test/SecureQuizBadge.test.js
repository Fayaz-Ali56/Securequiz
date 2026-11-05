const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("SecureQuizBadge", function () {
  const REWARD = ethers.parseEther("10");

  async function deployFixture() {
    const [owner, alice, bob] = await ethers.getSigners();

    const PlayToken = await ethers.getContractFactory("PlayToken");
    const playToken = await PlayToken.deploy();
    await playToken.waitForDeployment();

    const SecurityQuizGame = await ethers.getContractFactory("SecurityQuizGame");
    const game = await SecurityQuizGame.deploy(await playToken.getAddress());
    await game.waitForDeployment();
    await playToken.setGameContract(await game.getAddress());

    const SecureQuizBadge = await ethers.getContractFactory("SecureQuizBadge");
    const badge = await SecureQuizBadge.deploy(await game.getAddress());
    await badge.waitForDeployment();

    // Seed 3 questions and have alice answer all of them correctly, so she's
    // eligible for the first badge tier (threshold 3) but not the second (8).
    for (let i = 0; i < 3; i++) {
      await game.connect(owner).addQuestion(`Q${i}`, `answer${i}`, REWARD);
      await game.connect(alice).submitAnswer(i, `answer${i}`);
    }

    return { playToken, game, badge, owner, alice, bob };
  }

  it("reports the correct tier thresholds and names", async function () {
    const { badge } = await loadFixture(deployFixture);
    expect(await badge.tierCount()).to.equal(4);
    const [threshold, name] = await badge.getTierInfo(0);
    expect(threshold).to.equal(3);
    expect(name).to.equal("Bronze Auditor");
  });

  it("won't let a player claim a tier they haven't reached", async function () {
    const { badge, alice } = await loadFixture(deployFixture);
    // alice has 3 correct - eligible for tier 0 (3) but not tier 1 (8)
    await expect(badge.connect(alice).claimBadge(1)).to.be.revertedWith("SecureQuizBadge: not eligible yet");
  });

  it("mints the badge once a player is eligible", async function () {
    const { badge, alice } = await loadFixture(deployFixture);
    await expect(badge.connect(alice).claimBadge(0))
      .to.emit(badge, "BadgeClaimed")
      .withArgs(alice.address, 0, 0);

    expect(await badge.ownerOf(0)).to.equal(alice.address);
    expect(await badge.tokenTier(0)).to.equal(0);
  });

  it("won't let the same tier be claimed twice", async function () {
    const { badge, alice } = await loadFixture(deployFixture);
    await badge.connect(alice).claimBadge(0);
    await expect(badge.connect(alice).claimBadge(0)).to.be.revertedWith("SecureQuizBadge: already claimed");
  });

  it("won't let someone claim a tier for another player's progress", async function () {
    const { badge, bob } = await loadFixture(deployFixture);
    // bob has answered nothing - 0 correct, can't claim even tier 0 (needs 3)
    await expect(badge.connect(bob).claimBadge(0)).to.be.revertedWith("SecureQuizBadge: not eligible yet");
  });

  it("reports claim status correctly across all tiers", async function () {
    const { badge, alice } = await loadFixture(deployFixture);
    await badge.connect(alice).claimBadge(0);
    const status = await badge.getClaimStatus(alice.address);
    expect(status).to.deep.equal([true, false, false, false]);
  });

  it("is soulbound - blocks transfers between two addresses", async function () {
    const { badge, alice, bob } = await loadFixture(deployFixture);
    await badge.connect(alice).claimBadge(0);
    await expect(
      badge.connect(alice).transferFrom(alice.address, bob.address, 0)
    ).to.be.revertedWith("SecureQuizBadge: badges are soulbound");
  });

  it("produces a valid on-chain data URI with the tier name embedded", async function () {
    const { badge, alice } = await loadFixture(deployFixture);
    await badge.connect(alice).claimBadge(0);
    const uri = await badge.tokenURI(0);
    expect(uri).to.include("data:application/json;base64,");
    const base64Part = uri.split(",")[1];
    const decoded = Buffer.from(base64Part, "base64").toString("utf8");
    const metadata = JSON.parse(decoded);
    expect(metadata.name).to.equal("Bronze Auditor");
    expect(metadata.image).to.include("data:image/svg+xml;base64,");
  });
});
