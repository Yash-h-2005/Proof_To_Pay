// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ProofToPay
 * @notice Blockchain escrow core for physical robot task marketplace.
 * Enforces the core principle: WORK -> PROOF -> VERIFICATION -> PAYMENT.
 * Escrowed funds (MSTC / native token) are released to the robot ONLY after
 * independent off-chain verification confirms the physical sensor proof hash.
 */
contract ProofToPay is Ownable, ReentrancyGuard {
    // -------------------------------------------------------------
    // Enums & Structs
    // -------------------------------------------------------------

    enum TaskState {
        CREATED,          // Task declared by creator with reward specification
        FUNDED,           // Reward deposited into contract escrow by creator
        ASSIGNED,         // Robot assigned to the funded task
        WORKING,          // Robot acknowledged and started physical work
        PROOF_SUBMITTED,  // Physical proof hash recorded on-chain
        VERIFIED,         // Independent verifier confirmed proof validity
        PAID,             // Escrowed reward transferred to robot
        REFUNDED          // Escrowed reward returned to creator
    }

    struct Task {
        string taskId;             // Unique human-readable task identifier (e.g., "T001")
        address creator;           // Address of the user creating and funding the task
        address robot;             // Address representing the assigned robot
        uint256 reward;            // Task reward amount held in escrow (in native token/wei)
        string packageId;          // Package / asset identifier (e.g., RFID UID "P01")
        string source;             // Origin location / waypoint (e.g., "Zone A")
        string destination;        // Target location / waypoint (e.g., "Zone B")
        bytes32 proofHash;         // Cryptographic hash of off-chain sensor evidence
        TaskState state;           // Current lifecycle state of the task
        uint256 createdAt;         // Timestamp when task was created
        uint256 proofSubmittedAt;  // Timestamp when proof hash was submitted
        uint256 verifiedAt;        // Timestamp when verifier approved the task
    }

    // -------------------------------------------------------------
    // State Variables
    // -------------------------------------------------------------

    address public verifier;
    mapping(string => Task) private tasks;
    mapping(string => bool) private taskExists;
    string[] private allTaskIds;

    // -------------------------------------------------------------
    // Events
    // -------------------------------------------------------------

    event TaskCreated(
        string indexed taskId,
        address indexed creator,
        uint256 reward,
        string packageId,
        string source,
        string destination
    );

    event TaskFunded(
        string indexed taskId,
        address indexed creator,
        uint256 amount
    );

    event RobotAssigned(
        string indexed taskId,
        address indexed robot,
        address indexed creator
    );

    event TaskStarted(
        string indexed taskId,
        address indexed robot
    );

    event ProofSubmitted(
        string indexed taskId,
        address indexed submitter,
        bytes32 proofHash
    );

    event TaskVerified(
        string indexed taskId,
        address indexed verifier,
        bool success
    );

    event PaymentReleased(
        string indexed taskId,
        address indexed robot,
        uint256 amount
    );

    event TaskRefunded(
        string indexed taskId,
        address indexed creator,
        uint256 amount
    );

    event VerifierUpdated(
        address indexed oldVerifier,
        address indexed newVerifier
    );

    // -------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------

    constructor(address _initialVerifier) Ownable(msg.sender) {
        require(_initialVerifier != address(0), "Invalid verifier address");
        verifier = _initialVerifier;
        emit VerifierUpdated(address(0), _initialVerifier);
    }

    // -------------------------------------------------------------
    // Verifier Management
    // -------------------------------------------------------------

    /**
     * @notice Allows contract owner to update the authorized verifier address.
     * @param _newVerifier The new verifier address.
     */
    function setVerifier(address _newVerifier) external onlyOwner {
        require(_newVerifier != address(0), "Invalid verifier address");
        address oldVerifier = verifier;
        verifier = _newVerifier;
        emit VerifierUpdated(oldVerifier, _newVerifier);
    }

    // -------------------------------------------------------------
    // Core Functions
    // -------------------------------------------------------------

    /**
     * @notice 1. Creates a new physical task specification.
     * @param taskId Unique identifier for the task.
     * @param reward The amount of native tokens offered as reward upon verified completion.
     * @param packageId Identifier or RFID tag of the package to be moved.
     * @param source Pickup location / origin.
     * @param destination Delivery location / destination.
     */
    function createTask(
        string calldata taskId,
        uint256 reward,
        string calldata packageId,
        string calldata source,
        string calldata destination
    ) external {
        require(bytes(taskId).length > 0, "Task ID cannot be empty");
        require(!taskExists[taskId], "Task ID already exists");
        require(reward > 0, "Reward must be greater than zero");
        require(bytes(packageId).length > 0, "Package ID cannot be empty");

        tasks[taskId] = Task({
            taskId: taskId,
            creator: msg.sender,
            robot: address(0),
            reward: reward,
            packageId: packageId,
            source: source,
            destination: destination,
            proofHash: bytes32(0),
            state: TaskState.CREATED,
            createdAt: block.timestamp,
            proofSubmittedAt: 0,
            verifiedAt: 0
        });

        taskExists[taskId] = true;
        allTaskIds.push(taskId);

        emit TaskCreated(taskId, msg.sender, reward, packageId, source, destination);
    }

    /**
     * @notice 2. Funds the task reward escrow.
     * @param taskId Identifier of the task to fund.
     */
    function fundTask(string calldata taskId) external payable {
        require(taskExists[taskId], "Task does not exist");
        Task storage task = tasks[taskId];

        require(msg.sender == task.creator, "Only task creator can fund");
        require(task.state == TaskState.CREATED, "Task must be in CREATED state");
        require(msg.value == task.reward, "Supplied value does not match reward");

        task.state = TaskState.FUNDED;

        emit TaskFunded(taskId, msg.sender, msg.value);
    }

    /**
     * @notice 3. Assigns a robot to the funded task.
     * @param taskId Identifier of the task.
     * @param robot EVM address assigned to the robot.
     */
    function assignRobot(string calldata taskId, address robot) external {
        require(taskExists[taskId], "Task does not exist");
        Task storage task = tasks[taskId];

        require(msg.sender == task.creator, "Only task creator can assign robot");
        require(task.state == TaskState.FUNDED, "Task must be in FUNDED state");
        require(robot != address(0), "Invalid robot address");

        task.robot = robot;
        task.state = TaskState.ASSIGNED;

        emit RobotAssigned(taskId, robot, msg.sender);
    }

    /**
     * @notice 4. Marks that the assigned robot has commenced physical work.
     * @param taskId Identifier of the task.
     */
    function startTask(string calldata taskId) external {
        require(taskExists[taskId], "Task does not exist");
        Task storage task = tasks[taskId];

        require(msg.sender == task.robot, "Only assigned robot can start task");
        require(task.state == TaskState.ASSIGNED, "Task must be in ASSIGNED state");

        task.state = TaskState.WORKING;

        emit TaskStarted(taskId, msg.sender);
    }

    /**
     * @notice 5. Submits canonical cryptographic hash of physical proof evidence.
     * @param taskId Identifier of the task.
     * @param proofHash Cryptographic hash (keccak256 / SHA-256) of canonical sensor telemetry.
     */
    function submitProof(string calldata taskId, bytes32 proofHash) external {
        require(taskExists[taskId], "Task does not exist");
        Task storage task = tasks[taskId];

        require(task.state == TaskState.WORKING, "Task must be in WORKING state");
        require(
            msg.sender == task.robot || msg.sender == verifier,
            "Only assigned robot or authorized verifier can submit proof"
        );
        require(proofHash != bytes32(0), "Proof hash cannot be empty");

        task.proofHash = proofHash;
        task.proofSubmittedAt = block.timestamp;
        task.state = TaskState.PROOF_SUBMITTED;

        emit ProofSubmitted(taskId, msg.sender, proofHash);
    }

    /**
     * @notice 6. Independent verifier audits evidence and records verification decision.
     * @param taskId Identifier of the task.
     * @param success Boolean indicating whether proof meets physical verification rules.
     */
    function verifyTask(string calldata taskId, bool success) external {
        require(taskExists[taskId], "Task does not exist");
        require(msg.sender == verifier, "Only authorized verifier can verify task");

        Task storage task = tasks[taskId];
        require(
            task.state == TaskState.PROOF_SUBMITTED,
            "Task must be in PROOF_SUBMITTED state"
        );

        if (success) {
            task.state = TaskState.VERIFIED;
            task.verifiedAt = block.timestamp;
            emit TaskVerified(taskId, msg.sender, true);
        } else {
            // Task remains unverified and unpaid. Creator can subsequently refund or re-evaluate.
            emit TaskVerified(taskId, msg.sender, false);
        }
    }

    /**
     * @notice 7. Releases escrowed payment to the robot once verified.
     * Follows Checks-Effects-Interactions and protected by nonReentrant.
     * @param taskId Identifier of the task.
     */
    function releasePayment(string calldata taskId) external nonReentrant {
        require(taskExists[taskId], "Task does not exist");
        Task storage task = tasks[taskId];

        require(task.state == TaskState.VERIFIED, "Task must be in VERIFIED state");
        require(task.robot != address(0), "No robot assigned");

        uint256 payout = task.reward;
        require(payout > 0, "Reward must be greater than zero");

        // Effect
        task.state = TaskState.PAID;

        // Interaction
        (bool sent, ) = payable(task.robot).call{value: payout}("");
        require(sent, "Payment transfer failed");

        emit PaymentReleased(taskId, task.robot, payout);
    }

    /**
     * @notice 8. Allows task creator to recover escrowed reward if task cannot be completed.
     * Can only be called if task is not already PAID or REFUNDED, and is in an eligible state.
     * @param taskId Identifier of the task.
     */
    function refundTask(string calldata taskId) external nonReentrant {
        require(taskExists[taskId], "Task does not exist");
        Task storage task = tasks[taskId];

        require(msg.sender == task.creator, "Only task creator can request refund");
        require(task.state != TaskState.PAID, "Cannot refund an already paid task");
        require(task.state != TaskState.REFUNDED, "Task already refunded");

        // Safe allowed states: FUNDED, ASSIGNED, or PROOF_SUBMITTED (e.g., if verification failed)
        require(
            task.state == TaskState.FUNDED ||
            task.state == TaskState.ASSIGNED ||
            task.state == TaskState.PROOF_SUBMITTED,
            "Refund not allowed in current state"
        );

        uint256 refundAmount = task.reward;
        require(refundAmount > 0, "No funds to refund");

        // Effect
        task.state = TaskState.REFUNDED;

        // Interaction
        (bool sent, ) = payable(task.creator).call{value: refundAmount}("");
        require(sent, "Refund transfer failed");

        emit TaskRefunded(taskId, task.creator, refundAmount);
    }

    // -------------------------------------------------------------
    // View Functions
    // -------------------------------------------------------------

    /**
     * @notice Returns full task data.
     * @param taskId Identifier of the task.
     */
    function getTask(string calldata taskId) external view returns (Task memory) {
        require(taskExists[taskId], "Task does not exist");
        return tasks[taskId];
    }

    /**
     * @notice Returns the list of all task IDs created.
     */
    function getAllTaskIds() external view returns (string[] memory) {
        return allTaskIds;
    }

    /**
     * @notice Returns total number of tasks created.
     */
    function getTaskCount() external view returns (uint256) {
        return allTaskIds.length;
    }
}
