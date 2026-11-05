// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

interface ISecurityQuizGame {
    function totalCorrect(address player) external view returns (uint256);
}

/// @title SecureQuizBadge
/// @notice Soulbound (non-transferable) achievement NFTs for SecureQuiz milestones.
/// @dev Deliberately a SEPARATE contract from SecurityQuizGame - it only reads
///      totalCorrect() from the existing game contract, so the already-deployed
///      game and everyone's earned PLAY balances are completely untouched by
///      adding this. Metadata is generated fully on-chain (a small inline SVG,
///      base64-encoded) rather than pointing at an external image host, so the
///      badge never breaks if some third-party server disappears later.
contract SecureQuizBadge is ERC721, Ownable {
    using Strings for uint256;

    ISecurityQuizGame public immutable game;

    struct Tier {
        uint256 threshold; // totalCorrect needed on the game contract
        string name;
    }

    Tier[] public tiers;
    uint256 public nextTokenId;

    mapping(address => mapping(uint256 => bool)) public claimed; // player => tier => claimed?
    mapping(uint256 => uint256) public tokenTier; // tokenId => tier index

    event BadgeClaimed(address indexed player, uint256 indexed tier, uint256 tokenId);

    constructor(address _game) ERC721("SecureQuiz Badge", "SQBADGE") Ownable(msg.sender) {
        require(_game != address(0), "SecureQuizBadge: zero address");
        game = ISecurityQuizGame(_game);
        tiers.push(Tier(3, "Bronze Auditor"));
        tiers.push(Tier(8, "Silver Auditor"));
        tiers.push(Tier(15, "Gold Auditor"));
        tiers.push(Tier(24, "Platinum Auditor"));
    }

    /// @notice Mint the badge for a tier you've become eligible for. Reverts if
    ///         you haven't hit the threshold yet, or already claimed this tier.
    function claimBadge(uint256 tierIndex) external {
        require(tierIndex < tiers.length, "SecureQuizBadge: bad tier");
        require(!claimed[msg.sender][tierIndex], "SecureQuizBadge: already claimed");
        require(game.totalCorrect(msg.sender) >= tiers[tierIndex].threshold, "SecureQuizBadge: not eligible yet");

        claimed[msg.sender][tierIndex] = true;
        uint256 tokenId = nextTokenId++;
        tokenTier[tokenId] = tierIndex;
        _safeMint(msg.sender, tokenId);

        emit BadgeClaimed(msg.sender, tierIndex, tokenId);
    }

    function tierCount() external view returns (uint256) {
        return tiers.length;
    }

    function getTierInfo(uint256 tierIndex) external view returns (uint256 threshold, string memory name) {
        Tier memory t = tiers[tierIndex];
        return (t.threshold, t.name);
    }

    /// @notice Convenience getter so the frontend can build a badge gallery in one call.
    function getClaimStatus(address player) external view returns (bool[] memory claimedTiers) {
        claimedTiers = new bool[](tiers.length);
        for (uint256 i = 0; i < tiers.length; i++) {
            claimedTiers[i] = claimed[player][i];
        }
    }

    /// @dev Soulbound: block transfers between two non-zero addresses (i.e. a
    ///      normal transfer), while still allowing minting (from == address(0)).
    ///      Achievements you didn't earn shouldn't be purchasable on a marketplace.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert("SecureQuizBadge: badges are soulbound");
        }
        return super._update(to, tokenId, auth);
    }

    /// @dev Per-tier colours for the generated artwork. Kept as a function
    ///      rather than storage so it costs nothing to deploy or read.
    function _tierColors(uint256 tierIndex) internal pure returns (string memory light, string memory dark) {
        if (tierIndex == 0) return ("#E8A15C", "#A85F1F"); // bronze
        if (tierIndex == 1) return ("#E2E6EE", "#8C93A3"); // silver
        if (tierIndex == 2) return ("#FFD98A", "#D99A1E"); // gold
        return ("#B9F2F5", "#4FB6C4");                     // platinum
    }

    /// @notice Fully on-chain metadata. The SVG is generated here and returned
    ///         as a base64 data URI, so the badge renders in any wallet without
    ///         depending on IPFS or any image host staying online.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "SecureQuizBadge: nonexistent token");

        uint256 tierIndex = tokenTier[tokenId];
        Tier memory tier = tiers[tierIndex];
        (string memory light, string memory dark) = _tierColors(tierIndex);

        // First letter of the tier name, used as the medal glyph (B/S/G/P).
        bytes memory nameBytes = bytes(tier.name);
        bytes memory initial = new bytes(1);
        initial[0] = nameBytes[0];

        string memory head = string(
            abi.encodePacked(
                "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'>",
                "<defs>",
                "<linearGradient id='b' x1='0' y1='0' x2='0' y2='1'>",
                "<stop offset='0' stop-color='#2A1F52'/><stop offset='1' stop-color='#120D20'/>",
                "</linearGradient>",
                "<linearGradient id='m' x1='0' y1='0' x2='1' y2='1'>",
                "<stop offset='0' stop-color='", light, "'/><stop offset='1' stop-color='", dark, "'/>",
                "</linearGradient>",
                "</defs>",
                "<rect width='400' height='400' fill='url(#b)'/>"
            )
        );

        string memory medal = string(
            abi.encodePacked(
                "<rect x='13' y='13' width='374' height='374' rx='22' fill='none' stroke='", light,
                "' stroke-opacity='.3' stroke-width='1.5'/>",
                "<text x='200' y='58' font-size='13' fill='#A398D4' text-anchor='middle' font-family='Helvetica,Arial,sans-serif' letter-spacing='3'>SECUREQUIZ</text>",
                "<polygon points='200,92 260,127 260,197 200,232 140,197 140,127' fill='url(#m)'/>",
                "<polygon points='200,108 246,135 246,189 200,216 154,189 154,135' fill='#120D20' fill-opacity='.22'/>",
                "<text x='200' y='182' font-size='64' font-weight='bold' fill='#120D20' fill-opacity='.85' text-anchor='middle' font-family='Helvetica,Arial,sans-serif'>",
                string(initial),
                "</text>"
            )
        );

        string memory foot = string(
            abi.encodePacked(
                "<text x='200' y='288' font-size='27' font-weight='bold' fill='#F3EFFF' text-anchor='middle' font-family='Helvetica,Arial,sans-serif'>",
                tier.name,
                "</text>",
                "<text x='200' y='316' font-size='14' fill='", light,
                "' text-anchor='middle' font-family='Helvetica,Arial,sans-serif'>",
                tier.threshold.toString(),
                " vulnerabilities identified</text>",
                "<text x='200' y='358' font-size='11' fill='#7D72A8' text-anchor='middle' font-family='Helvetica,Arial,sans-serif'>Soulbound &#183; non-transferable</text>",
                "</svg>"
            )
        );

        string memory svg = string(abi.encodePacked(head, medal, foot));

        string memory json = string(
            abi.encodePacked(
                '{"name":"', tier.name,
                '","description":"Awarded for correctly identifying ',
                tier.threshold.toString(),
                ' smart contract vulnerabilities in SecureQuiz. Soulbound: this badge cannot be bought, sold or transferred, only earned.",',
                '"attributes":[',
                '{"trait_type":"Rank","value":"', tier.name, '"},',
                '{"trait_type":"Vulnerabilities identified","value":', tier.threshold.toString(), '},',
                '{"trait_type":"Transferable","value":"No"}',
                '],"image":"data:image/svg+xml;base64,',
                Base64.encode(bytes(svg)),
                '"}'
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }
}
