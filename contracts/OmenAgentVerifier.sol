// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

enum OracleType {
    TEE,
    ZKP
}

struct AccessProof {
    bytes32 oldDataHash;
    bytes32 newDataHash;
    bytes nonce;
    bytes encryptedPubKey;
    bytes proof;
}

struct OwnershipProof {
    OracleType oracleType;
    bytes32 oldDataHash;
    bytes32 newDataHash;
    bytes sealedKey;
    bytes encryptedPubKey;
    bytes nonce;
    bytes proof;
}

struct TransferValidityProof {
    AccessProof accessProof;
    OwnershipProof ownershipProof;
}

struct TransferValidityProofOutput {
    bytes32 oldDataHash;
    bytes32 newDataHash;
    bytes sealedKey;
    bytes encryptedPubKey;
    bytes wantedKey;
    address accessAssistant;
    bytes accessProofNonce;
    bytes ownershipProofNonce;
}

interface IERC7857DataVerifier {
    function verifyTransferValidity(
        TransferValidityProof[] calldata proofs
    ) external returns (TransferValidityProofOutput[] memory);
}

contract OmenAgentVerifier is IERC7857DataVerifier {
    address public owner;
    mapping(address => bool) public trustedAttestors;
    mapping(bytes32 => bool) public usedProofNonces;

    event OwnershipTransferred(address indexed previousOwner, address indexed nextOwner);
    event TrustedAttestorUpdated(address indexed attestor, bool trusted);
    event ProofConsumed(bytes32 indexed accessNonceHash, bytes32 indexed ownershipNonceHash);

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert("ONLY_OWNER");
        }
        _;
    }

    constructor(address initialOwner, address initialAttestor) {
        if (initialOwner == address(0)) {
            revert("OWNER_REQUIRED");
        }
        if (initialAttestor == address(0)) {
            revert("ATTESTOR_REQUIRED");
        }

        owner = initialOwner;
        trustedAttestors[initialAttestor] = true;

        emit OwnershipTransferred(address(0), initialOwner);
        emit TrustedAttestorUpdated(initialAttestor, true);
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        if (nextOwner == address(0)) {
            revert("OWNER_REQUIRED");
        }

        address previousOwner = owner;
        owner = nextOwner;
        emit OwnershipTransferred(previousOwner, nextOwner);
    }

    function setTrustedAttestor(address attestor, bool trusted) external onlyOwner {
        if (attestor == address(0)) {
            revert("ATTESTOR_REQUIRED");
        }

        trustedAttestors[attestor] = trusted;
        emit TrustedAttestorUpdated(attestor, trusted);
    }

    function verifyTransferValidity(
        TransferValidityProof[] calldata proofs
    ) external override returns (TransferValidityProofOutput[] memory outputs) {
        outputs = new TransferValidityProofOutput[](proofs.length);

        for (uint256 i = 0; i < proofs.length; i++) {
            TransferValidityProof calldata proof = proofs[i];

            if (proof.accessProof.oldDataHash != proof.ownershipProof.oldDataHash) {
                revert("OLD_HASH_MISMATCH");
            }
            if (proof.accessProof.newDataHash != proof.ownershipProof.newDataHash) {
                revert("NEW_HASH_MISMATCH");
            }
            if (keccak256(proof.accessProof.encryptedPubKey) != keccak256(proof.ownershipProof.encryptedPubKey)) {
                revert("PUBLIC_KEY_MISMATCH");
            }
            if (proof.ownershipProof.sealedKey.length == 0) {
                revert("SEALED_KEY_REQUIRED");
            }

            bytes32 accessNonceHash = keccak256(proof.accessProof.nonce);
            bytes32 ownershipNonceHash = keccak256(proof.ownershipProof.nonce);

            if (usedProofNonces[accessNonceHash] || usedProofNonces[ownershipNonceHash]) {
                revert("PROOF_ALREADY_USED");
            }

            address accessAssistant = _recoverAccessAssistant(proof.accessProof);
            address attestor = _recoverOwnershipAttestor(proof.ownershipProof);

            if (accessAssistant == address(0)) {
                revert("INVALID_ACCESS_PROOF");
            }
            if (!trustedAttestors[attestor]) {
                revert("UNTRUSTED_ATTESTOR");
            }

            usedProofNonces[accessNonceHash] = true;
            usedProofNonces[ownershipNonceHash] = true;

            outputs[i] = TransferValidityProofOutput({
                oldDataHash: proof.ownershipProof.oldDataHash,
                newDataHash: proof.ownershipProof.newDataHash,
                sealedKey: proof.ownershipProof.sealedKey,
                encryptedPubKey: proof.ownershipProof.encryptedPubKey,
                wantedKey: "",
                accessAssistant: accessAssistant,
                accessProofNonce: proof.accessProof.nonce,
                ownershipProofNonce: proof.ownershipProof.nonce
            });

            emit ProofConsumed(accessNonceHash, ownershipNonceHash);
        }
    }

    function _recoverAccessAssistant(AccessProof calldata proof) private view returns (address) {
        bytes32 digest = keccak256(
            abi.encode(
                "OMEN_ERC7857_ACCESS_PROOF",
                proof.oldDataHash,
                proof.newDataHash,
                keccak256(proof.encryptedPubKey),
                keccak256(proof.nonce),
                address(this),
                block.chainid
            )
        );

        return _recoverEthSignedMessage(digest, proof.proof);
    }

    function _recoverOwnershipAttestor(OwnershipProof calldata proof) private view returns (address) {
        bytes32 digest = keccak256(
            abi.encode(
                "OMEN_ERC7857_OWNERSHIP_PROOF",
                proof.oracleType,
                proof.oldDataHash,
                proof.newDataHash,
                keccak256(proof.sealedKey),
                keccak256(proof.encryptedPubKey),
                keccak256(proof.nonce),
                address(this),
                block.chainid
            )
        );

        return _recoverEthSignedMessage(digest, proof.proof);
    }

    function _recoverEthSignedMessage(bytes32 digest, bytes calldata signature) private pure returns (address) {
        if (signature.length != 65) {
            return address(0);
        }

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        if (v < 27) {
            v += 27;
        }
        if (v != 27 && v != 28) {
            return address(0);
        }

        bytes32 ethDigest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        return ecrecover(ethDigest, v, r, s);
    }
}
