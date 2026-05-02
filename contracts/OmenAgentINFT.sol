// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./OmenAgentVerifier.sol";

struct IntelligentData {
    string dataDescription;
    bytes32 dataHash;
}

struct IntelligenceVersion {
    uint256 version;
    string runId;
    string encryptedURI;
    bytes32 encryptedDataHash;
    bytes32 memoryRootHash;
    bytes32 proofManifestHash;
    uint256 updatedAt;
    uint256 blockNumber;
}

interface IERC7857Metadata {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function intelligentDataOf(uint256 tokenId) external view returns (IntelligentData[] memory);
    function intelligenceVersionCountOf(uint256 tokenId) external view returns (uint256);
    function intelligenceVersionOf(uint256 tokenId, uint256 version) external view returns (IntelligenceVersion memory);
    function latestIntelligenceVersionOf(uint256 tokenId) external view returns (IntelligenceVersion memory);
}

interface IERC7857 {
    event Approval(address indexed from, address indexed to, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event Authorization(address indexed from, address indexed to, uint256 indexed tokenId);
    event AuthorizationRevoked(address indexed from, address indexed to, uint256 indexed tokenId);
    event Transferred(uint256 tokenId, address indexed from, address indexed to);
    event Cloned(uint256 indexed tokenId, uint256 indexed newTokenId, address from, address to);
    event PublishedSealedKey(address indexed to, uint256 indexed tokenId, bytes[] sealedKeys);
    event DelegateAccess(address indexed user, address indexed assistant);

    function verifier() external view returns (IERC7857DataVerifier);
    function iTransfer(address to, uint256 tokenId, TransferValidityProof[] calldata proofs) external;
    function iClone(address to, uint256 tokenId, TransferValidityProof[] calldata proofs) external returns (uint256 newTokenId);
    function authorizeUsage(uint256 tokenId, address user) external;
    function revokeAuthorization(uint256 tokenId, address user) external;
    function approve(address to, uint256 tokenId) external;
    function setApprovalForAll(address operator, bool approved) external;
    function delegateAccess(address assistant) external;
    function ownerOf(uint256 tokenId) external view returns (address);
    function authorizedUsersOf(uint256 tokenId) external view returns (address[] memory);
    function getApproved(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function getDelegateAccess(address user) external view returns (address);
}

contract OmenAgentINFT is IERC7857, IERC7857Metadata {
    string private _name;
    string private _symbol;
    string public storageInfo;
    string public contractURI;
    address public owner;
    IERC7857DataVerifier private _verifier;
    uint256 private _nextTokenId = 1;

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    mapping(address => address) private _delegateAccess;
    mapping(uint256 => address[]) private _authorizedUsers;
    mapping(uint256 => mapping(address => bool)) private _isAuthorizedUser;
    mapping(uint256 => IntelligentData[]) private _intelligentData;
    mapping(uint256 => IntelligenceVersion[]) private _intelligenceVersions;
    mapping(uint256 => string) private _encryptedTokenURIs;

    event OwnershipTransferred(address indexed previousOwner, address indexed nextOwner);
    event MintedAgent(
        uint256 indexed tokenId,
        address indexed to,
        string encryptedURI,
        bytes32 indexed primaryDataHash
    );
    event IntelligenceUpdated(
        uint256 indexed tokenId,
        uint256 indexed version,
        string runId,
        string encryptedURI,
        bytes32 indexed primaryDataHash,
        bytes32 memoryRootHash,
        bytes32 proofManifestHash
    );
    event EncryptedURIUpdated(uint256 indexed tokenId, string encryptedURI);

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert("ONLY_OWNER");
        }
        _;
    }

    modifier tokenExists(uint256 tokenId) {
        if (_owners[tokenId] == address(0)) {
            revert("TOKEN_NOT_FOUND");
        }
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        string memory storageInfo_,
        string memory contractURI_,
        address verifier_,
        address initialOwner
    ) {
        if (verifier_ == address(0)) {
            revert("VERIFIER_REQUIRED");
        }
        if (initialOwner == address(0)) {
            revert("OWNER_REQUIRED");
        }

        _name = name_;
        _symbol = symbol_;
        storageInfo = storageInfo_;
        contractURI = contractURI_;
        _verifier = IERC7857DataVerifier(verifier_);
        owner = initialOwner;

        emit OwnershipTransferred(address(0), initialOwner);
    }

    function name() external view override returns (string memory) {
        return _name;
    }

    function symbol() external view override returns (string memory) {
        return _symbol;
    }

    function verifier() external view override returns (IERC7857DataVerifier) {
        return _verifier;
    }

    function balanceOf(address account) external view returns (uint256) {
        if (account == address(0)) {
            revert("ZERO_ADDRESS");
        }

        return _balances[account];
    }

    function ownerOf(uint256 tokenId) public view override tokenExists(tokenId) returns (address) {
        return _owners[tokenId];
    }

    function tokenURI(uint256 tokenId) external view tokenExists(tokenId) returns (string memory) {
        return _encryptedTokenURIs[tokenId];
    }

    function encryptedURIOf(uint256 tokenId) external view tokenExists(tokenId) returns (string memory) {
        return _encryptedTokenURIs[tokenId];
    }

    function intelligentDataOf(uint256 tokenId)
        external
        view
        override
        tokenExists(tokenId)
        returns (IntelligentData[] memory)
    {
        return _intelligentData[tokenId];
    }

    function intelligenceVersionCountOf(uint256 tokenId)
        external
        view
        override
        tokenExists(tokenId)
        returns (uint256)
    {
        return _intelligenceVersions[tokenId].length;
    }

    function intelligenceVersionOf(uint256 tokenId, uint256 version)
        external
        view
        override
        tokenExists(tokenId)
        returns (IntelligenceVersion memory)
    {
        if (version == 0 || version > _intelligenceVersions[tokenId].length) {
            revert("VERSION_NOT_FOUND");
        }

        return _intelligenceVersions[tokenId][version - 1];
    }

    function latestIntelligenceVersionOf(uint256 tokenId)
        external
        view
        override
        tokenExists(tokenId)
        returns (IntelligenceVersion memory)
    {
        uint256 versionCount = _intelligenceVersions[tokenId].length;

        if (versionCount == 0) {
            revert("VERSION_NOT_FOUND");
        }

        return _intelligenceVersions[tokenId][versionCount - 1];
    }

    function authorizedUsersOf(uint256 tokenId)
        external
        view
        override
        tokenExists(tokenId)
        returns (address[] memory)
    {
        return _authorizedUsers[tokenId];
    }

    function getApproved(uint256 tokenId) external view override tokenExists(tokenId) returns (address) {
        return _tokenApprovals[tokenId];
    }

    function isApprovedForAll(address tokenOwner, address operator) external view override returns (bool) {
        return _operatorApprovals[tokenOwner][operator];
    }

    function getDelegateAccess(address user) external view override returns (address) {
        return _delegateAccess[user];
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        if (nextOwner == address(0)) {
            revert("OWNER_REQUIRED");
        }

        address previousOwner = owner;
        owner = nextOwner;
        emit OwnershipTransferred(previousOwner, nextOwner);
    }

    function setVerifier(address verifier_) external onlyOwner {
        if (verifier_ == address(0)) {
            revert("VERIFIER_REQUIRED");
        }

        _verifier = IERC7857DataVerifier(verifier_);
    }

    function setContractURI(string calldata contractURI_) external onlyOwner {
        contractURI = contractURI_;
    }

    function setStorageInfo(string calldata storageInfo_) external onlyOwner {
        storageInfo = storageInfo_;
    }

    function mint(
        address to,
        string calldata encryptedURI,
        IntelligentData[] calldata data,
        bytes[] calldata sealedKeys
    ) external onlyOwner returns (uint256 tokenId) {
        if (to == address(0)) {
            revert("RECIPIENT_REQUIRED");
        }
        if (data.length == 0) {
            revert("INTELLIGENT_DATA_REQUIRED");
        }
        if (bytes(encryptedURI).length == 0) {
            revert("ENCRYPTED_URI_REQUIRED");
        }

        tokenId = _nextTokenId++;
        _owners[tokenId] = to;
        _balances[to] += 1;
        _encryptedTokenURIs[tokenId] = encryptedURI;

        for (uint256 i = 0; i < data.length; i++) {
            _pushValidatedData(tokenId, data[i]);
        }

        _recordIntelligenceVersion(tokenId, "", encryptedURI, data);

        emit Transfer(address(0), to, tokenId);
        emit Transferred(tokenId, address(0), to);
        emit MintedAgent(tokenId, to, encryptedURI, data[0].dataHash);

        if (sealedKeys.length > 0) {
            emit PublishedSealedKey(to, tokenId, sealedKeys);
        }
    }

    function updateIntelligence(
        uint256 tokenId,
        string calldata runId,
        string calldata encryptedURI,
        IntelligentData[] calldata data,
        bytes[] calldata sealedKeys
    ) external onlyOwner tokenExists(tokenId) {
        if (bytes(runId).length == 0) {
            revert("RUN_ID_REQUIRED");
        }
        if (data.length == 0) {
            revert("INTELLIGENT_DATA_REQUIRED");
        }
        if (bytes(encryptedURI).length == 0) {
            revert("ENCRYPTED_URI_REQUIRED");
        }

        delete _intelligentData[tokenId];
        _encryptedTokenURIs[tokenId] = encryptedURI;

        for (uint256 i = 0; i < data.length; i++) {
            _pushValidatedData(tokenId, data[i]);
        }

        IntelligenceVersion memory version = _recordIntelligenceVersion(
            tokenId,
            runId,
            encryptedURI,
            data
        );

        emit EncryptedURIUpdated(tokenId, encryptedURI);
        emit IntelligenceUpdated(
            tokenId,
            version.version,
            runId,
            encryptedURI,
            data[0].dataHash,
            version.memoryRootHash,
            version.proofManifestHash
        );

        if (sealedKeys.length > 0) {
            emit PublishedSealedKey(ownerOf(tokenId), tokenId, sealedKeys);
        }
    }

    function iTransfer(
        address to,
        uint256 tokenId,
        TransferValidityProof[] calldata proofs
    ) external override tokenExists(tokenId) {
        address from = ownerOf(tokenId);

        if (!_isApprovedOrOwner(msg.sender, tokenId)) {
            revert("NOT_APPROVED");
        }
        if (to == address(0)) {
            revert("RECIPIENT_REQUIRED");
        }

        bytes[] memory sealedKeys = _verifyAndUpdateData(tokenId, proofs);
        _clearAuthorization(tokenId);
        _transferToken(from, to, tokenId);

        emit Transferred(tokenId, from, to);
        emit PublishedSealedKey(to, tokenId, sealedKeys);
    }

    function iClone(
        address to,
        uint256 tokenId,
        TransferValidityProof[] calldata proofs
    ) external override tokenExists(tokenId) returns (uint256 newTokenId) {
        if (!_isApprovedOrOwner(msg.sender, tokenId)) {
            revert("NOT_APPROVED");
        }
        if (to == address(0)) {
            revert("RECIPIENT_REQUIRED");
        }

        TransferValidityProofOutput[] memory outputs = _verifier.verifyTransferValidity(proofs);
        if (outputs.length != _intelligentData[tokenId].length) {
            revert("PROOF_COUNT_MISMATCH");
        }

        newTokenId = _nextTokenId++;
        _owners[newTokenId] = to;
        _balances[to] += 1;
        _encryptedTokenURIs[newTokenId] = _encryptedTokenURIs[tokenId];

        bytes[] memory sealedKeys = new bytes[](outputs.length);

        for (uint256 i = 0; i < outputs.length; i++) {
            if (outputs[i].oldDataHash != _intelligentData[tokenId][i].dataHash) {
                revert("DATA_HASH_MISMATCH");
            }
            if (outputs[i].newDataHash == bytes32(0)) {
                revert("NEW_DATA_HASH_REQUIRED");
            }

            _intelligentData[newTokenId].push(
                IntelligentData({
                    dataDescription: _intelligentData[tokenId][i].dataDescription,
                    dataHash: outputs[i].newDataHash
                })
            );
            sealedKeys[i] = outputs[i].sealedKey;
        }

        _recordStoredIntelligenceVersion(newTokenId, "", _encryptedTokenURIs[newTokenId]);

        emit Transfer(address(0), to, newTokenId);
        emit Transferred(newTokenId, address(0), to);
        emit Cloned(tokenId, newTokenId, ownerOf(tokenId), to);
        emit PublishedSealedKey(to, newTokenId, sealedKeys);
    }

    function authorizeUsage(uint256 tokenId, address user) external override tokenExists(tokenId) {
        if (ownerOf(tokenId) != msg.sender) {
            revert("NOT_TOKEN_OWNER");
        }
        if (user == address(0)) {
            revert("USER_REQUIRED");
        }
        if (_isAuthorizedUser[tokenId][user]) {
            return;
        }

        _isAuthorizedUser[tokenId][user] = true;
        _authorizedUsers[tokenId].push(user);
        emit Authorization(msg.sender, user, tokenId);
    }

    function revokeAuthorization(uint256 tokenId, address user) external override tokenExists(tokenId) {
        if (ownerOf(tokenId) != msg.sender) {
            revert("NOT_TOKEN_OWNER");
        }
        if (!_isAuthorizedUser[tokenId][user]) {
            return;
        }

        _isAuthorizedUser[tokenId][user] = false;
        address[] storage users = _authorizedUsers[tokenId];

        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] == user) {
                users[i] = users[users.length - 1];
                users.pop();
                break;
            }
        }

        emit AuthorizationRevoked(msg.sender, user, tokenId);
    }

    function approve(address to, uint256 tokenId) public override tokenExists(tokenId) {
        address tokenOwner = ownerOf(tokenId);

        if (to == tokenOwner) {
            revert("APPROVAL_TO_OWNER");
        }
        if (msg.sender != tokenOwner && !_operatorApprovals[tokenOwner][msg.sender]) {
            revert("NOT_APPROVED_FOR_ALL");
        }

        _tokenApprovals[tokenId] = to;
        emit Approval(tokenOwner, to, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external override {
        if (operator == msg.sender) {
            revert("APPROVAL_TO_CALLER");
        }

        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function delegateAccess(address assistant) external override {
        _delegateAccess[msg.sender] = assistant;
        emit DelegateAccess(msg.sender, assistant);
    }

    function transferFrom(address from, address to, uint256 tokenId) external tokenExists(tokenId) {
        from;
        to;
        tokenId;
        revert("USE_ITRANSFER");
    }

    function _verifyAndUpdateData(
        uint256 tokenId,
        TransferValidityProof[] calldata proofs
    ) private returns (bytes[] memory sealedKeys) {
        TransferValidityProofOutput[] memory outputs = _verifier.verifyTransferValidity(proofs);

        if (outputs.length != _intelligentData[tokenId].length) {
            revert("PROOF_COUNT_MISMATCH");
        }

        sealedKeys = new bytes[](outputs.length);

        for (uint256 i = 0; i < outputs.length; i++) {
            if (outputs[i].oldDataHash != _intelligentData[tokenId][i].dataHash) {
                revert("DATA_HASH_MISMATCH");
            }
            if (outputs[i].newDataHash == bytes32(0)) {
                revert("NEW_DATA_HASH_REQUIRED");
            }

            _intelligentData[tokenId][i].dataHash = outputs[i].newDataHash;
            sealedKeys[i] = outputs[i].sealedKey;
        }
    }

    function _pushValidatedData(uint256 tokenId, IntelligentData calldata data) private {
        if (data.dataHash == bytes32(0)) {
            revert("DATA_HASH_REQUIRED");
        }
        if (bytes(data.dataDescription).length == 0) {
            revert("DATA_DESCRIPTION_REQUIRED");
        }

        _intelligentData[tokenId].push(data);
    }

    function _recordIntelligenceVersion(
        uint256 tokenId,
        string memory runId,
        string memory encryptedURI,
        IntelligentData[] calldata data
    ) private returns (IntelligenceVersion memory version) {
        bytes32 memoryRootHash = data.length > 1 ? data[1].dataHash : bytes32(0);
        bytes32 proofManifestHash = data.length > 2 ? data[2].dataHash : bytes32(0);

        version = IntelligenceVersion({
            version: _intelligenceVersions[tokenId].length + 1,
            runId: runId,
            encryptedURI: encryptedURI,
            encryptedDataHash: data[0].dataHash,
            memoryRootHash: memoryRootHash,
            proofManifestHash: proofManifestHash,
            updatedAt: block.timestamp,
            blockNumber: block.number
        });

        _intelligenceVersions[tokenId].push(version);
    }

    function _recordStoredIntelligenceVersion(
        uint256 tokenId,
        string memory runId,
        string memory encryptedURI
    ) private returns (IntelligenceVersion memory version) {
        uint256 dataLength = _intelligentData[tokenId].length;
        bytes32 memoryRootHash = dataLength > 1 ? _intelligentData[tokenId][1].dataHash : bytes32(0);
        bytes32 proofManifestHash = dataLength > 2 ? _intelligentData[tokenId][2].dataHash : bytes32(0);

        version = IntelligenceVersion({
            version: _intelligenceVersions[tokenId].length + 1,
            runId: runId,
            encryptedURI: encryptedURI,
            encryptedDataHash: _intelligentData[tokenId][0].dataHash,
            memoryRootHash: memoryRootHash,
            proofManifestHash: proofManifestHash,
            updatedAt: block.timestamp,
            blockNumber: block.number
        });

        _intelligenceVersions[tokenId].push(version);
    }

    function _transferToken(address from, address to, uint256 tokenId) private {
        delete _tokenApprovals[tokenId];
        _balances[from] -= 1;
        _balances[to] += 1;
        _owners[tokenId] = to;
        emit Transfer(from, to, tokenId);
    }

    function _clearAuthorization(uint256 tokenId) private {
        address[] storage users = _authorizedUsers[tokenId];

        for (uint256 i = 0; i < users.length; i++) {
            _isAuthorizedUser[tokenId][users[i]] = false;
        }

        delete _authorizedUsers[tokenId];
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) private view returns (bool) {
        address tokenOwner = ownerOf(tokenId);

        return spender == tokenOwner ||
            _tokenApprovals[tokenId] == spender ||
            _operatorApprovals[tokenOwner][spender];
    }

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
}
