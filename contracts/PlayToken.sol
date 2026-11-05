// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title PlayToken (PLAY)
/// @notice The reward token players earn from the Security Quiz Game.
/// @dev SECURITY NOTES (write these in your report):
///      1. Minting is restricted to a single "game contract" address, set once
///         by the owner. This is the classic access-control pattern: only one
///         trusted contract can create new supply, so a bug in some future
///         contract can't be used to mint unlimited tokens.
///      2. `gameContract` can only be set ONCE (see `setGameContract`), which
///         prevents the owner from later swapping in a malicious minter after
///         the token already has real-world value - a common rug-pull vector.
///      3. Built on OpenZeppelin's audited ERC20 implementation rather than
///         hand-rolled token logic, which avoids reintroducing bugs (like the
///         historical integer-overflow issues) that audited libraries already
///         solved.
contract PlayToken is ERC20, Ownable {
    address public gameContract;
    bool public gameContractSet;

    event GameContractSet(address indexed gameContract);

    constructor() ERC20("PlayToken", "PLAY") Ownable(msg.sender) {}

    modifier onlyGameContract() {
        require(msg.sender == gameContract, "PlayToken: caller is not the game contract");
        _;
    }

    /// @notice Wire up the game contract that's allowed to mint rewards.
    /// @dev Can only be called once, and only by the owner, to prevent the
    ///      mint permission from being silently reassigned later.
    function setGameContract(address _gameContract) external onlyOwner {
        require(!gameContractSet, "PlayToken: game contract already set");
        require(_gameContract != address(0), "PlayToken: zero address");
        gameContract = _gameContract;
        gameContractSet = true;
        emit GameContractSet(_gameContract);
    }

    /// @notice Mint reward tokens to a player. Only callable by the game contract.
    function mintReward(address to, uint256 amount) external onlyGameContract {
        _mint(to, amount);
    }
}
