const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ProofToPay Smart Contract", function () {
  let proofToPay;
  let owner;
  let creator;
  let robot;
  let verifier;
  let unauthorizedAccount;

  const TASK_ID = "T001";
  const PACKAGE_ID = "P01";
  const SOURCE = "Zone A";
  const DESTINATION = "Zone B";
  const REWARD = ethers.parseEther("100"); // 100 MSTC / Native tokens
  const PROOF_HASH = ethers.keccak256(
    ethers.toUtf8Bytes("T001-P01-ZoneA-ZoneB-proof")
  );

  // Enum mapping matching ProofToPay.sol
  const TaskState = {
    CREATED: 0,
    FUNDED: 1,
    ASSIGNED: 2,
    WORKING: 3,
    PROOF_SUBMITTED: 4,
    VERIFIED: 5,
    PAID: 6,
    REFUNDED: 7,
  };

  beforeEach(async function () {
    [owner, creator, robot, verifier, unauthorizedAccount] =
      await ethers.getSigners();

    const ProofToPayFactory = await ethers.getContractFactory("ProofToPay");
    proofToPay = await ProofToPayFactory.deploy(verifier.address);
    await proofToPay.waitForDeployment();
  });

  describe("Deployment & Role Initialization", function () {
    it("should set the initial owner and verifier correctly", async function () {
      expect(await proofToPay.owner()).to.equal(owner.address);
      expect(await proofToPay.verifier()).to.equal(verifier.address);
    });

    it("should allow owner to update the verifier", async function () {
      await expect(
        proofToPay.connect(owner).setVerifier(unauthorizedAccount.address)
      )
        .to.emit(proofToPay, "VerifierUpdated")
        .withArgs(verifier.address, unauthorizedAccount.address);

      expect(await proofToPay.verifier()).to.equal(unauthorizedAccount.address);
    });

    it("should reject non-owner updating the verifier", async function () {
      await expect(
        proofToPay.connect(unauthorizedAccount).setVerifier(unauthorizedAccount.address)
      ).to.be.revertedWithCustomError(proofToPay, "OwnableUnauthorizedAccount");
    });
  });

  describe("Complete Happy Path: Work -> Proof -> Verification -> Payment", function () {
    it("should complete the full lifecycle successfully", async function () {
      // 1. Create task
      await expect(
        proofToPay
          .connect(creator)
          .createTask(TASK_ID, REWARD, PACKAGE_ID, SOURCE, DESTINATION)
      )
        .to.emit(proofToPay, "TaskCreated")
        .withArgs(TASK_ID, creator.address, REWARD, PACKAGE_ID, SOURCE, DESTINATION);

      let task = await proofToPay.getTask(TASK_ID);
      expect(task.state).to.equal(TaskState.CREATED);
      expect(task.reward).to.equal(REWARD);
      expect(task.creator).to.equal(creator.address);

      // 2. Fund task
      await expect(
        proofToPay.connect(creator).fundTask(TASK_ID, { value: REWARD })
      )
        .to.emit(proofToPay, "TaskFunded")
        .withArgs(TASK_ID, creator.address, REWARD);

      task = await proofToPay.getTask(TASK_ID);
      expect(task.state).to.equal(TaskState.FUNDED);

      // Verify contract holds the escrowed funds
      const contractBalance = await ethers.provider.getBalance(
        await proofToPay.getAddress()
      );
      expect(contractBalance).to.equal(REWARD);

      // 3. Assign robot
      await expect(
        proofToPay.connect(creator).assignRobot(TASK_ID, robot.address)
      )
        .to.emit(proofToPay, "RobotAssigned")
        .withArgs(TASK_ID, robot.address, creator.address);

      task = await proofToPay.getTask(TASK_ID);
      expect(task.state).to.equal(TaskState.ASSIGNED);
      expect(task.robot).to.equal(robot.address);

      // 4. Robot starts task
      await expect(proofToPay.connect(robot).startTask(TASK_ID))
        .to.emit(proofToPay, "TaskStarted")
        .withArgs(TASK_ID, robot.address);

      task = await proofToPay.getTask(TASK_ID);
      expect(task.state).to.equal(TaskState.WORKING);

      // 5. Robot submits proof
      await expect(proofToPay.connect(robot).submitProof(TASK_ID, PROOF_HASH))
        .to.emit(proofToPay, "ProofSubmitted")
        .withArgs(TASK_ID, robot.address, PROOF_HASH);

      task = await proofToPay.getTask(TASK_ID);
      expect(task.state).to.equal(TaskState.PROOF_SUBMITTED);
      expect(task.proofHash).to.equal(PROOF_HASH);

      // 6. Independent verifier audits evidence and confirms
      await expect(proofToPay.connect(verifier).verifyTask(TASK_ID, true))
        .to.emit(proofToPay, "TaskVerified")
        .withArgs(TASK_ID, verifier.address, true);

      task = await proofToPay.getTask(TASK_ID);
      expect(task.state).to.equal(TaskState.VERIFIED);

      // 7. Release payment to robot
      const robotInitialBalance = await ethers.provider.getBalance(robot.address);

      await expect(proofToPay.connect(creator).releasePayment(TASK_ID))
        .to.emit(proofToPay, "PaymentReleased")
        .withArgs(TASK_ID, robot.address, REWARD);

      task = await proofToPay.getTask(TASK_ID);
      expect(task.state).to.equal(TaskState.PAID);

      const robotFinalBalance = await ethers.provider.getBalance(robot.address);
      expect(robotFinalBalance - robotInitialBalance).to.equal(REWARD);

      // Verify contract balance is now zero
      const contractFinalBalance = await ethers.provider.getBalance(
        await proofToPay.getAddress()
      );
      expect(contractFinalBalance).to.equal(0n);
    });
  });

  describe("Negative Tests & Edge Cases", function () {
    it("1. Duplicate task ID rejected", async function () {
      await proofToPay
        .connect(creator)
        .createTask(TASK_ID, REWARD, PACKAGE_ID, SOURCE, DESTINATION);

      await expect(
        proofToPay
          .connect(creator)
          .createTask(TASK_ID, REWARD, PACKAGE_ID, SOURCE, DESTINATION)
      ).to.be.revertedWith("Task ID already exists");
    });

    it("2. Non-creator cannot fund", async function () {
      await proofToPay
        .connect(creator)
        .createTask(TASK_ID, REWARD, PACKAGE_ID, SOURCE, DESTINATION);

      await expect(
        proofToPay
          .connect(unauthorizedAccount)
          .fundTask(TASK_ID, { value: REWARD })
      ).to.be.revertedWith("Only task creator can fund");
    });

    it("3. Wrong funding amount rejected", async function () {
      await proofToPay
        .connect(creator)
        .createTask(TASK_ID, REWARD, PACKAGE_ID, SOURCE, DESTINATION);

      const wrongAmount = ethers.parseEther("50");
      await expect(
        proofToPay.connect(creator).fundTask(TASK_ID, { value: wrongAmount })
      ).to.be.revertedWith("Supplied value does not match reward");
    });

    it("4. Robot cannot start another robot's task", async function () {
      await proofToPay
        .connect(creator)
        .createTask(TASK_ID, REWARD, PACKAGE_ID, SOURCE, DESTINATION);
      await proofToPay.connect(creator).fundTask(TASK_ID, { value: REWARD });
      await proofToPay.connect(creator).assignRobot(TASK_ID, robot.address);

      await expect(
        proofToPay.connect(unauthorizedAccount).startTask(TASK_ID)
      ).to.be.revertedWith("Only assigned robot can start task");
    });

    it("5. Empty proof hash rejected", async function () {
      await proofToPay
        .connect(creator)
        .createTask(TASK_ID, REWARD, PACKAGE_ID, SOURCE, DESTINATION);
      await proofToPay.connect(creator).fundTask(TASK_ID, { value: REWARD });
      await proofToPay.connect(creator).assignRobot(TASK_ID, robot.address);
      await proofToPay.connect(robot).startTask(TASK_ID);

      await expect(
        proofToPay.connect(robot).submitProof(TASK_ID, ethers.ZeroHash)
      ).to.be.revertedWith("Proof hash cannot be empty");
    });

    it("6. Unauthorized verifier rejected", async function () {
      await proofToPay
        .connect(creator)
        .createTask(TASK_ID, REWARD, PACKAGE_ID, SOURCE, DESTINATION);
      await proofToPay.connect(creator).fundTask(TASK_ID, { value: REWARD });
      await proofToPay.connect(creator).assignRobot(TASK_ID, robot.address);
      await proofToPay.connect(robot).startTask(TASK_ID);
      await proofToPay.connect(robot).submitProof(TASK_ID, PROOF_HASH);

      await expect(
        proofToPay.connect(unauthorizedAccount).verifyTask(TASK_ID, true)
      ).to.be.revertedWith("Only authorized verifier can verify task");
    });

    it("7. Cannot verify before proof submission", async function () {
      await proofToPay
        .connect(creator)
        .createTask(TASK_ID, REWARD, PACKAGE_ID, SOURCE, DESTINATION);
      await proofToPay.connect(creator).fundTask(TASK_ID, { value: REWARD });
      await proofToPay.connect(creator).assignRobot(TASK_ID, robot.address);
      await proofToPay.connect(robot).startTask(TASK_ID);

      // Still in WORKING state, not PROOF_SUBMITTED
      await expect(
        proofToPay.connect(verifier).verifyTask(TASK_ID, true)
      ).to.be.revertedWith("Task must be in PROOF_SUBMITTED state");
    });

    it("8. Cannot release before verification", async function () {
      await proofToPay
        .connect(creator)
        .createTask(TASK_ID, REWARD, PACKAGE_ID, SOURCE, DESTINATION);
      await proofToPay.connect(creator).fundTask(TASK_ID, { value: REWARD });
      await proofToPay.connect(creator).assignRobot(TASK_ID, robot.address);
      await proofToPay.connect(robot).startTask(TASK_ID);
      await proofToPay.connect(robot).submitProof(TASK_ID, PROOF_HASH);

      // In PROOF_SUBMITTED, not yet VERIFIED
      await expect(
        proofToPay.connect(creator).releasePayment(TASK_ID)
      ).to.be.revertedWith("Task must be in VERIFIED state");
    });

    it("9. Cannot release payment twice", async function () {
      await proofToPay
        .connect(creator)
        .createTask(TASK_ID, REWARD, PACKAGE_ID, SOURCE, DESTINATION);
      await proofToPay.connect(creator).fundTask(TASK_ID, { value: REWARD });
      await proofToPay.connect(creator).assignRobot(TASK_ID, robot.address);
      await proofToPay.connect(robot).startTask(TASK_ID);
      await proofToPay.connect(robot).submitProof(TASK_ID, PROOF_HASH);
      await proofToPay.connect(verifier).verifyTask(TASK_ID, true);

      // First release succeeds
      await proofToPay.connect(creator).releasePayment(TASK_ID);

      // Second release fails
      await expect(
        proofToPay.connect(creator).releasePayment(TASK_ID)
      ).to.be.revertedWith("Task must be in VERIFIED state");
    });

    it("10. Cannot refund an already paid task", async function () {
      await proofToPay
        .connect(creator)
        .createTask(TASK_ID, REWARD, PACKAGE_ID, SOURCE, DESTINATION);
      await proofToPay.connect(creator).fundTask(TASK_ID, { value: REWARD });
      await proofToPay.connect(creator).assignRobot(TASK_ID, robot.address);
      await proofToPay.connect(robot).startTask(TASK_ID);
      await proofToPay.connect(robot).submitProof(TASK_ID, PROOF_HASH);
      await proofToPay.connect(verifier).verifyTask(TASK_ID, true);
      await proofToPay.connect(creator).releasePayment(TASK_ID);

      await expect(
        proofToPay.connect(creator).refundTask(TASK_ID)
      ).to.be.revertedWith("Cannot refund an already paid task");
    });

    it("11. Allows creator to refund an uncompleted/failed task", async function () {
      await proofToPay
        .connect(creator)
        .createTask(TASK_ID, REWARD, PACKAGE_ID, SOURCE, DESTINATION);
      await proofToPay.connect(creator).fundTask(TASK_ID, { value: REWARD });

      const initialCreatorBalance = await ethers.provider.getBalance(creator.address);

      const tx = await proofToPay.connect(creator).refundTask(TASK_ID);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const finalCreatorBalance = await ethers.provider.getBalance(creator.address);
      expect(finalCreatorBalance).to.equal(
        initialCreatorBalance + REWARD - gasUsed
      );

      const task = await proofToPay.getTask(TASK_ID);
      expect(task.state).to.equal(TaskState.REFUNDED);
    });

    it("12. Non-creator cannot request refund", async function () {
      await proofToPay
        .connect(creator)
        .createTask(TASK_ID, REWARD, PACKAGE_ID, SOURCE, DESTINATION);
      await proofToPay.connect(creator).fundTask(TASK_ID, { value: REWARD });

      await expect(
        proofToPay.connect(unauthorizedAccount).refundTask(TASK_ID)
      ).to.be.revertedWith("Only task creator can request refund");
    });

    it("13. Handles verifier rejection safely without releasing funds", async function () {
      await proofToPay
        .connect(creator)
        .createTask(TASK_ID, REWARD, PACKAGE_ID, SOURCE, DESTINATION);
      await proofToPay.connect(creator).fundTask(TASK_ID, { value: REWARD });
      await proofToPay.connect(creator).assignRobot(TASK_ID, robot.address);
      await proofToPay.connect(robot).startTask(TASK_ID);
      await proofToPay.connect(robot).submitProof(TASK_ID, PROOF_HASH);

      // Verifier rejects the task
      await expect(proofToPay.connect(verifier).verifyTask(TASK_ID, false))
        .to.emit(proofToPay, "TaskVerified")
        .withArgs(TASK_ID, verifier.address, false);

      // State remains PROOF_SUBMITTED (not VERIFIED)
      const task = await proofToPay.getTask(TASK_ID);
      expect(task.state).to.equal(TaskState.PROOF_SUBMITTED);

      // Payment release must fail
      await expect(
        proofToPay.connect(creator).releasePayment(TASK_ID)
      ).to.be.revertedWith("Task must be in VERIFIED state");

      // Creator is safely allowed to refund
      await expect(proofToPay.connect(creator).refundTask(TASK_ID))
        .to.emit(proofToPay, "TaskRefunded")
        .withArgs(TASK_ID, creator.address, REWARD);
    });
  });
});
