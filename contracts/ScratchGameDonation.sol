// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ScratchGameDonation
 * @notice Contract for handling $1 USDC donations for the Scratch Game
 * @dev Supporters donate $1 USDC to get Supporter badge and FCFS free NFT mint
 */
contract ScratchGameDonation is Ownable, ReentrancyGuard {
    // USDC on Base Mainnet
    IERC20 public constant USDC = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);
    
    // Donation amount: $1 USDC (6 decimals)
    uint256 public constant DONATION_AMOUNT = 1_000_000;
    
    // Mapping to track supporters
    mapping(address => bool) public isSupporter;
    mapping(address => uint256) public donatedAt;
    
    // Array of all supporters for export
    address[] public supporters;
    
    // Events
    event Donated(address indexed supporter, uint256 amount, uint256 timestamp);
    event Withdrawn(address indexed owner, uint256 amount);
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @notice Donate $1 USDC to become a Supporter
     * @dev Requires USDC approval first
     */
    function donate() external nonReentrant {
        require(!isSupporter[msg.sender], "Already a supporter");
        require(
            USDC.transferFrom(msg.sender, address(this), DONATION_AMOUNT),
            "USDC transfer failed"
        );
        
        isSupporter[msg.sender] = true;
        donatedAt[msg.sender] = block.timestamp;
        supporters.push(msg.sender);
        
        emit Donated(msg.sender, DONATION_AMOUNT, block.timestamp);
    }
    
    /**
     * @notice Check if an address is a supporter
     */
    function checkSupporter(address _address) external view returns (bool, uint256) {
        return (isSupporter[_address], donatedAt[_address]);
    }
    
    /**
     * @notice Get total number of supporters
     */
    function totalSupporters() external view returns (uint256) {
        return supporters.length;
    }
    
    /**
     * @notice Get supporters list for NFT distribution
     * @param offset Start index
     * @param limit Number of addresses to return
     */
    function getSupporters(uint256 offset, uint256 limit) 
        external 
        view 
        returns (address[] memory) 
    {
        uint256 end = offset + limit;
        if (end > supporters.length) {
            end = supporters.length;
        }
        
        address[] memory result = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = supporters[i];
        }
        return result;
    }
    
    /**
     * @notice Owner withdraws all collected USDC
     */
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = USDC.balanceOf(address(this));
        require(balance > 0, "No USDC to withdraw");
        require(USDC.transfer(owner(), balance), "Withdraw failed");
        
        emit Withdrawn(owner(), balance);
    }
    
    /**
     * @notice Get contract USDC balance
     */
    function getBalance() external view returns (uint256) {
        return USDC.balanceOf(address(this));
    }
}
