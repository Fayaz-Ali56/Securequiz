const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("SecurityQuizGame", function () {
  async function deployFixture() {
    const [owner, alice, bob] = await ethers.getSigners();

    const PlayToken = await ethers.getContractFactory("PlayToken");
    const playToken = await PlayToken.deploy();
    await playToken.waitForDeployment();

    const SecurityQuizGame = await ethers.getContractFactory("SecurityQuizGame");
    const game = await SecurityQuizGame.deploy(await playToken.getAddress());
    await game.waitForDeployment();

    await playToken.setGameContract(await game.getAddress());

    return { playToken, game, owner, alice, bob };
  }

  const REWARD = ethers.parseEther("10");

  describe("Deployment & wiring", function () {
    it("wires the token and game contract together", async function () {
      const { playToken, game } = await loadFixture(deployFixture);
      expect(await playToken.gameContract()).to.equal(await game.getAddress());
      expect(await playToken.gameContractSet()).to.equal(true);
    });

    it("won't let the game contract be re-pointed after it's set once", async function () {
      const { playToken, alice } = await loadFixture(deployFixture);
      await expect(playToken.setGameContract(alice.address)).to.be.revertedWith(
        "PlayToken: game contract already set"
      );
    });

    it("only lets the game contract mint rewards", async function () {
      const { playToken, alice } = await loadFixture(deployFixture);
      await expect(playToken.connect(alice).mintReward(alice.address, REWARD)).to.be.revertedWith(
        "PlayToken: caller is not the game contract"
      );
    });
  });

  describe("Access control", function () {
    it("only the owner can add questions", async function () {
      const { game, alice } = await loadFixture(deployFixture);
      await expect(
        game.connect(alice).addQuestion("What is reentrancy?", "reentrancy", REWARD)
      ).to.be.revertedWithCustomError(game, "OwnableUnauthorizedAccount");
    });

    it("only the owner can pause the game", async function () {
      const { game, alice } = await loadFixture(deployFixture);
      await expect(game.connect(alice).pause()).to.be.revertedWithCustomError(
        game,
        "OwnableUnauthorizedAccount"
      );
    });

    it("blocks answers while paused", async function () {
      const { game, owner, alice } = await loadFixture(deployFixture);
      await game.connect(owner).addQuestion("Q0", "answer0", REWARD);
      await game.connect(owner).pause();
      await expect(game.connect(alice).submitAnswer(0, "answer0")).to.be.revertedWithCustomError(
        game,
        "EnforcedPause"
      );
    });
  });

  describe("Answering questions", function () {
    it("pays out the reward and marks the question solved on a correct answer", async function () {
      const { game, playToken, owner, alice } = await loadFixture(deployFixture);
      await game.connect(owner).addQuestion(
        "What Solidity keyword restricts a function to the contract owner?",
        "onlyOwner",
        REWARD
      );

      await expect(game.connect(alice).submitAnswer(0, "onlyOwner"))
        .to.emit(game, "AnswerCorrect")
        .withArgs(alice.address, 0, REWARD, 1);

      expect(await playToken.balanceOf(alice.address)).to.equal(REWARD);
      expect(await game.hasAnswered(alice.address, 0)).to.equal(true);
      expect(await game.streak(alice.address)).to.equal(1);
    });

    it("does not revert on a wrong answer, but resets the streak and pays nothing", async function () {
      const { game, playToken, owner, alice } = await loadFixture(deployFixture);
      await game.connect(owner).addQuestion("Q0", "correct-answer", REWARD);

      await expect(game.connect(alice).submitAnswer(0, "wrong-guess"))
        .to.emit(game, "AnswerIncorrect")
        .withArgs(alice.address, 0);

      expect(await playToken.balanceOf(alice.address)).to.equal(0);
      expect(await game.hasAnswered(alice.address, 0)).to.equal(false);
    });

    it("won't let the same player solve a question twice", async function () {
      const { game, owner, alice } = await loadFixture(deployFixture);
      await game.connect(owner).addQuestion("Q0", "answer0", REWARD);
      await game.connect(alice).submitAnswer(0, "answer0");

      await expect(game.connect(alice).submitAnswer(0, "answer0")).to.be.revertedWith(
        "SecurityQuizGame: already solved this one"
      );
    });

    it("enforces a cooldown between repeated attempts on the same question", async function () {
      const { game, owner, alice } = await loadFixture(deployFixture);
      await game.connect(owner).addQuestion("Q0", "correct-answer", REWARD);

      await game.connect(alice).submitAnswer(0, "wrong-guess-1");
      await expect(game.connect(alice).submitAnswer(0, "wrong-guess-2")).to.be.revertedWith(
        "SecurityQuizGame: slow down, cooldown active"
      );

      // fast-forward past the cooldown and confirm it works again
      await time.increase(61);
      await expect(game.connect(alice).submitAnswer(0, "correct-answer")).to.emit(game, "AnswerCorrect");
    });

    it("pays a streak bonus on every 3rd consecutive correct answer", async function () {
      const { game, playToken, owner, alice } = await loadFixture(deployFixture);
      await game.connect(owner).addQuestion("Q0", "a0", REWARD);
      await game.connect(owner).addQuestion("Q1", "a1", REWARD);
      await game.connect(owner).addQuestion("Q2", "a2", REWARD);

      await game.connect(alice).submitAnswer(0, "a0");
      await game.connect(alice).submitAnswer(1, "a1");
      const bonusReward = REWARD + (REWARD * 50n) / 100n;

      await expect(game.connect(alice).submitAnswer(2, "a2"))
        .to.emit(game, "AnswerCorrect")
        .withArgs(alice.address, 2, bonusReward, 3);

      const expectedTotal = REWARD + REWARD + bonusReward;
      expect(await playToken.balanceOf(alice.address)).to.equal(expectedTotal);
    });

    it("resets the streak after a wrong answer breaks it", async function () {
      const { game, owner, alice } = await loadFixture(deployFixture);
      await game.connect(owner).addQuestion("Q0", "a0", REWARD);
      await game.connect(owner).addQuestion("Q1", "a1", REWARD);

      await game.connect(alice).submitAnswer(0, "a0");
      expect(await game.streak(alice.address)).to.equal(1);

      await game.connect(alice).submitAnswer(1, "wrong-guess");
      expect(await game.streak(alice.address)).to.equal(0);
    });
  });

  describe("Reentrancy protection (the important one)", function () {
    it("blocks a malicious reward token from reentering submitAnswer for a different question", async function () {
      const { owner, alice } = await loadFixture(deployFixture);

      // This test deploys its own game instance pointed at a MALICIOUS mock
      // token instead of the real PlayToken, to simulate a reward token with
      // a transfer hook (like ERC777) that tries to call back into the game.
      const MaliciousToken = await ethers.getContractFactory("MaliciousReentrantToken");
      const maliciousToken = await MaliciousToken.deploy();
      await maliciousToken.waitForDeployment();

      const SecurityQuizGame = await ethers.getContractFactory("SecurityQuizGame");
      const game = await SecurityQuizGame.deploy(await maliciousToken.getAddress());
      await game.waitForDeployment();

      // Two questions: the one being answered, and a second, still-unsolved
      // one that the malicious token will try to reenter with.
      await game.connect(owner).addQuestion("Q0", "answer0", REWARD);
      await game.connect(owner).addQuestion("Q1", "answer1", REWARD);

      await maliciousToken.configure(await game.getAddress(), 1, "answer1");

      // Answering Q0 triggers maliciousToken.mintReward(), which immediately
      // tries to call game.submitAnswer(1, "answer1") again, mid-execution.
      // Checks-effects-interactions wouldn't catch this alone (Q1 hasn't been
      // answered yet) - it's nonReentrant that has to stop it.
      await expect(game.connect(alice).submitAnswer(0, "answer0")).to.be.reverted;

      // And because the whole transaction reverted, NEITHER question ended
      // up marked as solved - the attack gained nothing.
      expect(await game.hasAnswered(alice.address, 0)).to.equal(false);
      expect(await game.hasAnswered(alice.address, 1)).to.equal(false);
    });
  });
});
