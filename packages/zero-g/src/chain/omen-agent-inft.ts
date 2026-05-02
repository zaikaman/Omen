export const omenAgentInftAbi = [
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "name_",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "symbol_",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "storageInfo_",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "contractURI_",
        "type": "string"
      },
      {
        "internalType": "address",
        "name": "verifier_",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "initialOwner",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "from",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "Approval",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "operator",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "approved",
        "type": "bool"
      }
    ],
    "name": "ApprovalForAll",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "from",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "Authorization",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "from",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "AuthorizationRevoked",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "newTokenId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "from",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "to",
        "type": "address"
      }
    ],
    "name": "Cloned",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "assistant",
        "type": "address"
      }
    ],
    "name": "DelegateAccess",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "encryptedURI",
        "type": "string"
      }
    ],
    "name": "EncryptedURIUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "version",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "runId",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "encryptedURI",
        "type": "string"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "primaryDataHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "memoryRootHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "proofManifestHash",
        "type": "bytes32"
      }
    ],
    "name": "IntelligenceUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "encryptedURI",
        "type": "string"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "primaryDataHash",
        "type": "bytes32"
      }
    ],
    "name": "MintedAgent",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "nextOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bytes[]",
        "name": "sealedKeys",
        "type": "bytes[]"
      }
    ],
    "name": "PublishedSealedKey",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "from",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "Transfer",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "from",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "to",
        "type": "address"
      }
    ],
    "name": "Transferred",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "approve",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "authorizeUsage",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "authorizedUsersOf",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "",
        "type": "address[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "contractURI",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "assistant",
        "type": "address"
      }
    ],
    "name": "delegateAccess",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "encryptedURIOf",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "getApproved",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "getDelegateAccess",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "components": [
          {
            "components": [
              {
                "internalType": "bytes32",
                "name": "oldDataHash",
                "type": "bytes32"
              },
              {
                "internalType": "bytes32",
                "name": "newDataHash",
                "type": "bytes32"
              },
              {
                "internalType": "bytes",
                "name": "nonce",
                "type": "bytes"
              },
              {
                "internalType": "bytes",
                "name": "encryptedPubKey",
                "type": "bytes"
              },
              {
                "internalType": "bytes",
                "name": "proof",
                "type": "bytes"
              }
            ],
            "internalType": "struct AccessProof",
            "name": "accessProof",
            "type": "tuple"
          },
          {
            "components": [
              {
                "internalType": "enum OracleType",
                "name": "oracleType",
                "type": "uint8"
              },
              {
                "internalType": "bytes32",
                "name": "oldDataHash",
                "type": "bytes32"
              },
              {
                "internalType": "bytes32",
                "name": "newDataHash",
                "type": "bytes32"
              },
              {
                "internalType": "bytes",
                "name": "sealedKey",
                "type": "bytes"
              },
              {
                "internalType": "bytes",
                "name": "encryptedPubKey",
                "type": "bytes"
              },
              {
                "internalType": "bytes",
                "name": "nonce",
                "type": "bytes"
              },
              {
                "internalType": "bytes",
                "name": "proof",
                "type": "bytes"
              }
            ],
            "internalType": "struct OwnershipProof",
            "name": "ownershipProof",
            "type": "tuple"
          }
        ],
        "internalType": "struct TransferValidityProof[]",
        "name": "proofs",
        "type": "tuple[]"
      }
    ],
    "name": "iClone",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "newTokenId",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "components": [
          {
            "components": [
              {
                "internalType": "bytes32",
                "name": "oldDataHash",
                "type": "bytes32"
              },
              {
                "internalType": "bytes32",
                "name": "newDataHash",
                "type": "bytes32"
              },
              {
                "internalType": "bytes",
                "name": "nonce",
                "type": "bytes"
              },
              {
                "internalType": "bytes",
                "name": "encryptedPubKey",
                "type": "bytes"
              },
              {
                "internalType": "bytes",
                "name": "proof",
                "type": "bytes"
              }
            ],
            "internalType": "struct AccessProof",
            "name": "accessProof",
            "type": "tuple"
          },
          {
            "components": [
              {
                "internalType": "enum OracleType",
                "name": "oracleType",
                "type": "uint8"
              },
              {
                "internalType": "bytes32",
                "name": "oldDataHash",
                "type": "bytes32"
              },
              {
                "internalType": "bytes32",
                "name": "newDataHash",
                "type": "bytes32"
              },
              {
                "internalType": "bytes",
                "name": "sealedKey",
                "type": "bytes"
              },
              {
                "internalType": "bytes",
                "name": "encryptedPubKey",
                "type": "bytes"
              },
              {
                "internalType": "bytes",
                "name": "nonce",
                "type": "bytes"
              },
              {
                "internalType": "bytes",
                "name": "proof",
                "type": "bytes"
              }
            ],
            "internalType": "struct OwnershipProof",
            "name": "ownershipProof",
            "type": "tuple"
          }
        ],
        "internalType": "struct TransferValidityProof[]",
        "name": "proofs",
        "type": "tuple[]"
      }
    ],
    "name": "iTransfer",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "intelligenceVersionCountOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "version",
        "type": "uint256"
      }
    ],
    "name": "intelligenceVersionOf",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "version",
            "type": "uint256"
          },
          {
            "internalType": "string",
            "name": "runId",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "encryptedURI",
            "type": "string"
          },
          {
            "internalType": "bytes32",
            "name": "encryptedDataHash",
            "type": "bytes32"
          },
          {
            "internalType": "bytes32",
            "name": "memoryRootHash",
            "type": "bytes32"
          },
          {
            "internalType": "bytes32",
            "name": "proofManifestHash",
            "type": "bytes32"
          },
          {
            "internalType": "uint256",
            "name": "updatedAt",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "blockNumber",
            "type": "uint256"
          }
        ],
        "internalType": "struct IntelligenceVersion",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "intelligentDataOf",
    "outputs": [
      {
        "components": [
          {
            "internalType": "string",
            "name": "dataDescription",
            "type": "string"
          },
          {
            "internalType": "bytes32",
            "name": "dataHash",
            "type": "bytes32"
          }
        ],
        "internalType": "struct IntelligentData[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "tokenOwner",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "operator",
        "type": "address"
      }
    ],
    "name": "isApprovedForAll",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "latestIntelligenceVersionOf",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "version",
            "type": "uint256"
          },
          {
            "internalType": "string",
            "name": "runId",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "encryptedURI",
            "type": "string"
          },
          {
            "internalType": "bytes32",
            "name": "encryptedDataHash",
            "type": "bytes32"
          },
          {
            "internalType": "bytes32",
            "name": "memoryRootHash",
            "type": "bytes32"
          },
          {
            "internalType": "bytes32",
            "name": "proofManifestHash",
            "type": "bytes32"
          },
          {
            "internalType": "uint256",
            "name": "updatedAt",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "blockNumber",
            "type": "uint256"
          }
        ],
        "internalType": "struct IntelligenceVersion",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "encryptedURI",
        "type": "string"
      },
      {
        "components": [
          {
            "internalType": "string",
            "name": "dataDescription",
            "type": "string"
          },
          {
            "internalType": "bytes32",
            "name": "dataHash",
            "type": "bytes32"
          }
        ],
        "internalType": "struct IntelligentData[]",
        "name": "data",
        "type": "tuple[]"
      },
      {
        "internalType": "bytes[]",
        "name": "sealedKeys",
        "type": "bytes[]"
      }
    ],
    "name": "mint",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "ownerOf",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "revokeAuthorization",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "operator",
        "type": "address"
      },
      {
        "internalType": "bool",
        "name": "approved",
        "type": "bool"
      }
    ],
    "name": "setApprovalForAll",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "contractURI_",
        "type": "string"
      }
    ],
    "name": "setContractURI",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "storageInfo_",
        "type": "string"
      }
    ],
    "name": "setStorageInfo",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "verifier_",
        "type": "address"
      }
    ],
    "name": "setVerifier",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "storageInfo",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "tokenURI",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "from",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "transferFrom",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "nextOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "runId",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "encryptedURI",
        "type": "string"
      },
      {
        "components": [
          {
            "internalType": "string",
            "name": "dataDescription",
            "type": "string"
          },
          {
            "internalType": "bytes32",
            "name": "dataHash",
            "type": "bytes32"
          }
        ],
        "internalType": "struct IntelligentData[]",
        "name": "data",
        "type": "tuple[]"
      },
      {
        "internalType": "bytes[]",
        "name": "sealedKeys",
        "type": "bytes[]"
      }
    ],
    "name": "updateIntelligence",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "verifier",
    "outputs": [
      {
        "internalType": "contract IERC7857DataVerifier",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const omenAgentInftBytecode = "0x60806040526001600655348015610014575f5ffd5b506040516143a03803806143a083398101604081905261003391610217565b6001600160a01b0382166100825760405162461bcd60e51b8152602060048201526011602482015270159154925192515497d491545552549151607a1b60448201526064015b60405180910390fd5b6001600160a01b0381166100c95760405162461bcd60e51b815260206004820152600e60248201526d13d5d3915497d49154555254915160921b6044820152606401610079565b5f6100d48782610380565b5060016100e18682610380565b5060026100ee8582610380565b5060036100fb8482610380565b50600580546001600160a01b038085166001600160a01b0319928316179092556004805492841692909116821790556040515f907f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0908290a350505050505061043e565b634e487b7160e01b5f52604160045260245ffd5b5f82601f830112610182575f5ffd5b81516001600160401b0381111561019b5761019b61015f565b604051601f8201601f19908116603f011681016001600160401b03811182821017156101c9576101c961015f565b6040528181528382016020018510156101e0575f5ffd5b8160208501602083015e5f918101602001919091529392505050565b80516001600160a01b0381168114610212575f5ffd5b919050565b5f5f5f5f5f5f60c0878903121561022c575f5ffd5b86516001600160401b03811115610241575f5ffd5b61024d89828a01610173565b602089015190975090506001600160401b0381111561026a575f5ffd5b61027689828a01610173565b604089015190965090506001600160401b03811115610293575f5ffd5b61029f89828a01610173565b606089015190955090506001600160401b038111156102bc575f5ffd5b6102c889828a01610173565b9350506102d7608088016101fc565b91506102e560a088016101fc565b90509295509295509295565b600181811c9082168061030557607f821691505b60208210810361032357634e487b7160e01b5f52602260045260245ffd5b50919050565b601f82111561037b578282111561037b57805f5260205f20601f840160051c602085101561035457505f5b90810190601f840160051c035f5b81811015610377575f83820155600101610362565b5050505b505050565b81516001600160401b038111156103995761039961015f565b6103ad816103a784546102f1565b84610329565b6020601f8211600181146103df575f83156103c85750848201515b5f19600385901b1c1916600184901b178455610437565b5f84815260208120601f198516915b8281101561040e57878501518255602094850194600190920191016103ee565b508482101561042b57868401515f19600387901b60f8161c191681555b505060018360011b0184555b5050505050565b613f558061044b5f395ff3fe608060405234801561000f575f5ffd5b50600436106101e7575f3560e01c806398bd57de11610109578063dfadc4ff1161009e578063e985e9c51161006e578063e985e9c51461043b578063f2fde38b1461045e578063fa83d14e14610471578063fd08bca914610484575f5ffd5b8063dfadc4ff14610405578063e734737514610418578063e8a3d48514610420578063e915c38a14610428575f5ffd5b8063b2f06d85116100d9578063b2f06d85146103cc578063c3612ef7146103df578063c394e893146103f2578063c87b56dd14610405575f5ffd5b806398bd57de146103805780639ca7b00514610393578063a22cb465146103a6578063b0654873146103b9575f5ffd5b80635437988d1161017f5780637feb73be1161014f5780637feb73be1461033f5780638da5cb5b14610352578063938e3d7b1461036557806395d89b4114610378575f5ffd5b80635437988d146102d85780636352211e146102eb57806370a08231146102fe5780637bb124a91461031f575f5ffd5b80631aeb542f116101ba5780631aeb542f1461027457806323b872dd146102945780632b7ac3f3146102a7578063393df216146102b8575f5ffd5b806306fdde03146101eb578063081812fc14610209578063095ea7b3146102345780630e592fdd14610249575b5f5ffd5b6101f3610497565b6040516102009190612e3f565b60405180910390f35b61021c610217366004612e58565b610526565b6040516001600160a01b039091168152602001610200565b610247610242366004612e86565b610584565b005b61021c610257366004612eb0565b6001600160a01b039081165f908152600b60205260409020541690565b610287610282366004612e58565b6106f6565b6040516102009190612ecb565b6102476102a2366004612f16565b610796565b6005546001600160a01b031661021c565b6102cb6102c6366004612e58565b610803565b6040516102009190612f54565b6102476102e6366004612eb0565b610938565b61021c6102f9366004612e58565b6109ce565b61031161030c366004612eb0565b610a1f565b604051908152602001610200565b61033261032d366004612fcb565b610a80565b6040516102009190612feb565b61024761034d3660046130f3565b610cbb565b60045461021c906001600160a01b031681565b6102476103733660046131c8565b610fd6565b6101f3611012565b61024761038e366004612eb0565b611021565b6103116103a1366004612e58565b611077565b6102476103b4366004613206565b6110bf565b6102476103c7366004613241565b611177565b6103326103da366004612e58565b6112ca565b6102476103ed366004613298565b6114fd565b6102476104003660046131c8565b611714565b6101f3610413366004612e58565b61174b565b6101f3611815565b6101f36118a1565b610311610436366004613241565b6118ae565b61044e6104493660046132bb565b611efe565b6040519015158152602001610200565b61024761046c366004612eb0565b611f2d565b61024761047f366004613298565b611fef565b6103116104923660046132e7565b61216d565b60605f80546104a590613395565b80601f01602080910402602001604051908101604052809291908181526020018280546104d190613395565b801561051c5780601f106104f35761010080835404028352916020019161051c565b820191905f5260205f20905b8154815290600101906020018083116104ff57829003601f168201915b5050505050905090565b5f8181526007602052604081205482906001600160a01b03166105645760405162461bcd60e51b815260040161055b906133c7565b60405180910390fd5b5f838152600960205260409020546001600160a01b031691505b50919050565b5f8181526007602052604090205481906001600160a01b03166105b95760405162461bcd60e51b815260040161055b906133c7565b5f6105c3836109ce565b9050806001600160a01b0316846001600160a01b03160361061a5760405162461bcd60e51b815260206004820152601160248201527020a8282927ab20a62faa27afa7aba722a960791b604482015260640161055b565b336001600160a01b0382161480159061065657506001600160a01b0381165f908152600a6020908152604080832033845290915290205460ff16155b1561069a5760405162461bcd60e51b81526020600482015260146024820152731393d517d054141493d5915117d193d497d0531360621b604482015260640161055b565b5f8381526009602052604080822080546001600160a01b0319166001600160a01b0388811691821790925591518693918516917f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92591a450505050565b5f8181526007602052604090205460609082906001600160a01b031661072e5760405162461bcd60e51b815260040161055b906133c7565b5f838152600c60209081526040918290208054835181840281018401909452808452909183018282801561078957602002820191905f5260205f20905b81546001600160a01b0316815260019091019060200180831161076b575b5050505050915050919050565b5f8181526007602052604090205481906001600160a01b03166107cb5760405162461bcd60e51b815260040161055b906133c7565b60405162461bcd60e51b815260206004820152600d60248201526c2aa9a2afa4aa2920a729a322a960991b604482015260640161055b565b5f8181526007602052604090205460609082906001600160a01b031661083b5760405162461bcd60e51b815260040161055b906133c7565b5f838152600e6020908152604080832080548251818502810185019093528083529193909284015b8282101561092c578382905f5260205f2090600202016040518060400160405290815f8201805461089390613395565b80601f01602080910402602001604051908101604052809291908181526020018280546108bf90613395565b801561090a5780601f106108e15761010080835404028352916020019161090a565b820191905f5260205f20905b8154815290600101906020018083116108ed57829003601f168201915b5050505050815260200160018201548152505081526020019060010190610863565b50505050915050919050565b6004546001600160a01b031633146109625760405162461bcd60e51b815260040161055b906133f0565b6001600160a01b0381166109ac5760405162461bcd60e51b8152602060048201526011602482015270159154925192515497d491545552549151607a1b604482015260640161055b565b600580546001600160a01b0319166001600160a01b0392909216919091179055565b5f8181526007602052604081205482906001600160a01b0316610a035760405162461bcd60e51b815260040161055b906133c7565b50505f908152600760205260409020546001600160a01b031690565b5f6001600160a01b038216610a655760405162461bcd60e51b815260206004820152600c60248201526b5a45524f5f4144445245535360a01b604482015260640161055b565b506001600160a01b03165f9081526008602052604090205490565b610a88612d29565b5f8381526007602052604090205483906001600160a01b0316610abd5760405162461bcd60e51b815260040161055b906133c7565b821580610ad657505f848152600f602052604090205483115b15610b175760405162461bcd60e51b815260206004820152601160248201527015915494d253d397d393d517d193d55391607a1b604482015260640161055b565b5f848152600f60205260409020610b2f600185613428565b81548110610b3f57610b3f61343b565b905f5260205f209060080201604051806101000160405290815f8201548152602001600182018054610b7090613395565b80601f0160208091040260200160405190810160405280929190818152602001828054610b9c90613395565b8015610be75780601f10610bbe57610100808354040283529160200191610be7565b820191905f5260205f20905b815481529060010190602001808311610bca57829003601f168201915b50505050508152602001600282018054610c0090613395565b80601f0160208091040260200160405190810160405280929190818152602001828054610c2c90613395565b8015610c775780601f10610c4e57610100808354040283529160200191610c77565b820191905f5260205f20905b815481529060010190602001808311610c5a57829003601f168201915b505050505081526020016003820154815260200160048201548152602001600582015481526020016006820154815260200160078201548152505091505092915050565b6004546001600160a01b03163314610ce55760405162461bcd60e51b815260040161055b906133f0565b5f8981526007602052604090205489906001600160a01b0316610d1a5760405162461bcd60e51b815260040161055b906133c7565b5f889003610d5c5760405162461bcd60e51b815260206004820152600f60248201526e14955397d25117d491545552549151608a1b604482015260640161055b565b5f849003610da85760405162461bcd60e51b81526020600482015260196024820152781253951153131251d1539517d110551057d491545552549151603a1b604482015260640161055b565b5f869003610df15760405162461bcd60e51b8152602060048201526016602482015275115390d4965415115117d5549257d49154555254915160521b604482015260640161055b565b5f8a8152600e60205260408120610e0791612d68565b5f8a8152601060205260409020610e1f8789836134cd565b505f5b84811015610e5f57610e578b878784818110610e4057610e4061343b565b9050602002810190610e529190613582565b612472565b600101610e22565b505f610ed78b8b8b8080601f0160208091040260200160405190810160405280939291908181526020018383808284375f9201919091525050604080516020601f8f018190048102820181019092528d815292508d91508c90819084018382808284375f920191909152508c92508b91506125449050565b90508a7f89f78a60287c4efc9f814fd5ed49580a0800b3c17190a5476f1918d16510a0f78989604051610f0b9291906135c8565b60405180910390a285855f818110610f2557610f2561343b565b9050602002810190610f379190613582565b60200135815f01518c7f95e50381f102a04512ca88fc01038fcb852646cbe06b820fd800e9a3daa7c1f98d8d8d8d88608001518960a00151604051610f81969594939291906135db565b60405180910390a48215610fc9578a610f998c6109ce565b6001600160a01b03165f516020613f005f395f51905f528686604051610fc0929190613658565b60405180910390a35b5050505050505050505050565b6004546001600160a01b031633146110005760405162461bcd60e51b815260040161055b906133f0565b600361100d8284836134cd565b505050565b6060600180546104a590613395565b335f818152600b602052604080822080546001600160a01b0319166001600160a01b03861690811790915590519092917f57a5f7ce01affd949c0efd1484fd811d31ff5c8ca21c7006f5f4de7292f26de491a350565b5f8181526007602052604081205482906001600160a01b03166110ac5760405162461bcd60e51b815260040161055b906133c7565b50505f908152600f602052604090205490565b336001600160a01b0383160361110c5760405162461bcd60e51b815260206004820152601260248201527120a8282927ab20a62faa27afa1a0a62622a960711b604482015260640161055b565b335f818152600a602090815260408083206001600160a01b03871680855290835292819020805460ff191686151590811790915590519081529192917f17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31910160405180910390a35050565b5f8381526007602052604090205483906001600160a01b03166111ac5760405162461bcd60e51b815260040161055b906133c7565b5f6111b6856109ce565b90506111c233866126d7565b6111fd5760405162461bcd60e51b815260206004820152600c60248201526b1393d517d054141493d5915160a21b604482015260640161055b565b6001600160a01b0386166112235760405162461bcd60e51b815260040161055b906136bd565b5f61122f868686612753565b905061123a86612a11565b611245828888612aa2565b866001600160a01b0316826001600160a01b03167f0ea8df787dde63a7bdc34d17097adf25749a3521f660e92dabdff8d6ee91d18a8860405161128a91815260200190565b60405180910390a385876001600160a01b03165f516020613f005f395f51905f52836040516112b991906136e9565b60405180910390a350505050505050565b6112d2612d29565b5f8281526007602052604090205482906001600160a01b03166113075760405162461bcd60e51b815260040161055b906133c7565b5f838152600f6020526040812054908190036113595760405162461bcd60e51b815260206004820152601160248201527015915494d253d397d393d517d193d55391607a1b604482015260640161055b565b5f848152600f60205260409020611371600183613428565b815481106113815761138161343b565b905f5260205f209060080201604051806101000160405290815f82015481526020016001820180546113b290613395565b80601f01602080910402602001604051908101604052809291908181526020018280546113de90613395565b80156114295780601f1061140057610100808354040283529160200191611429565b820191905f5260205f20905b81548152906001019060200180831161140c57829003601f168201915b5050505050815260200160028201805461144290613395565b80601f016020809104026020016040519081016040528092919081815260200182805461146e90613395565b80156114b95780601f10611490576101008083540402835291602001916114b9565b820191905f5260205f20905b81548152906001019060200180831161149c57829003601f168201915b505050505081526020016003820154815260200160048201548152602001600582015481526020016006820154815260200160078201548152505092505050919050565b5f8281526007602052604090205482906001600160a01b03166115325760405162461bcd60e51b815260040161055b906133c7565b3361153c846109ce565b6001600160a01b0316146115845760405162461bcd60e51b815260206004820152600f60248201526e2727aa2faa27a5a2a72fa7aba722a960891b604482015260640161055b565b5f838152600d602090815260408083206001600160a01b038616845290915290205460ff161561100d575f838152600d602090815260408083206001600160a01b03861684528252808320805460ff19169055858352600c9091528120905b81548110156116d657836001600160a01b03168282815481106116085761160861343b565b5f918252602090912001546001600160a01b0316036116ce578154829061163190600190613428565b815481106116415761164161343b565b905f5260205f20015f9054906101000a90046001600160a01b031682828154811061166e5761166e61343b565b905f5260205f20015f6101000a8154816001600160a01b0302191690836001600160a01b03160217905550818054806116a9576116a9613740565b5f8281526020902081015f1990810180546001600160a01b03191690550190556116d6565b6001016115e3565b5060405184906001600160a01b0385169033907fd1662978c81e15f621e7a38524048493c6e86d91a24a29619d164bef0a8d0a98905f90a450505050565b6004546001600160a01b0316331461173e5760405162461bcd60e51b815260040161055b906133f0565b600261100d8284836134cd565b5f8181526007602052604090205460609082906001600160a01b03166117835760405162461bcd60e51b815260040161055b906133c7565b5f838152601060205260409020805461179b90613395565b80601f01602080910402602001604051908101604052809291908181526020018280546117c790613395565b80156107895780601f106117e957610100808354040283529160200191610789565b820191905f5260205f20905b8154815290600101906020018083116117f5575093979650505050505050565b6002805461182290613395565b80601f016020809104026020016040519081016040528092919081815260200182805461184e90613395565b80156118995780601f1061187057610100808354040283529160200191611899565b820191905f5260205f20905b81548152906001019060200180831161187c57829003601f168201915b505050505081565b6003805461182290613395565b5f8381526007602052604081205484906001600160a01b03166118e35760405162461bcd60e51b815260040161055b906133c7565b6118ed33866126d7565b6119285760405162461bcd60e51b815260206004820152600c60248201526b1393d517d054141493d5915160a21b604482015260640161055b565b6001600160a01b03861661194e5760405162461bcd60e51b815260040161055b906136bd565b600554604051636fb1808b60e11b81525f916001600160a01b03169063df630116906119809088908890600401613856565b5f604051808303815f875af115801561199b573d5f5f3e3d5ffd5b505050506040513d5f823e601f3d908101601f191682016040526119c29190810190613a5a565b5f878152600e6020526040902054815191925014611a195760405162461bcd60e51b81526020600482015260146024820152730a0a49e9e8cbe869eaa9ca8be9a92a69a82a886960631b604482015260640161055b565b60068054905f611a2883613c2b565b909155505f81815260076020908152604080832080546001600160a01b0319166001600160a01b038d169081179091558352600890915281208054929550600192909190611a77908490613c43565b90915550505f86815260106020526040808220858352912090611a9a9082613c56565b505f81516001600160401b03811115611ab557611ab561344f565b604051908082528060200260200182016040528015611ae857816020015b6060815260200190600190039081611ad35790505b5090505f5b8251811015611d4d575f888152600e60205260409020805482908110611b1557611b1561343b565b905f5260205f20906002020160010154838281518110611b3757611b3761343b565b60200260200101515f015114611b845760405162461bcd60e51b815260206004820152601260248201527108882a882be9082a690be9a92a69a82a886960731b604482015260640161055b565b5f5f1b838281518110611b9957611b9961343b565b60200260200101516020015103611beb5760405162461bcd60e51b8152602060048201526016602482015275139155d7d110551057d21054d217d49154555254915160521b604482015260640161055b565b5f858152600e6020526040808220815180830183528b845291909220805482919085908110611c1c57611c1c61343b565b905f5260205f2090600202015f018054611c3590613395565b80601f0160208091040260200160405190810160405280929190818152602001828054611c6190613395565b8015611cac5780601f10611c8357610100808354040283529160200191611cac565b820191905f5260205f20905b815481529060010190602001808311611c8f57829003601f168201915b50505050508152602001858481518110611cc857611cc861343b565b60209081029190910181015181015190915282546001810184555f93845292208151919260020201908190611cfd9082613d25565b50602082015181600101555050828181518110611d1c57611d1c61343b565b602002602001015160400151828281518110611d3a57611d3a61343b565b6020908102919091010152600101611aed565b50611dfe8460405180602001604052805f81525060105f8881526020019081526020015f208054611d7d90613395565b80601f0160208091040260200160405190810160405280929190818152602001828054611da990613395565b8015611df45780601f10611dcb57610100808354040283529160200191611df4565b820191905f5260205f20905b815481529060010190602001808311611dd757829003601f168201915b5050505050612b71565b5060405184906001600160a01b038a16905f907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef908290a46040518481526001600160a01b038916905f907f0ea8df787dde63a7bdc34d17097adf25749a3521f660e92dabdff8d6ee91d18a9060200160405180910390a383877f40b442ee2bb535802063305b95f127b5101e5fce261a5dec9379683eaaad8cdb611ea28a6109ce565b604080516001600160a01b039283168152918d1660208301520160405180910390a383886001600160a01b03165f516020613f005f395f51905f5283604051611eeb91906136e9565b60405180910390a3505050949350505050565b6001600160a01b038083165f908152600a602090815260408083209385168352929052205460ff165b92915050565b6004546001600160a01b03163314611f575760405162461bcd60e51b815260040161055b906133f0565b6001600160a01b038116611f9e5760405162461bcd60e51b815260206004820152600e60248201526d13d5d3915497d49154555254915160921b604482015260640161055b565b600480546001600160a01b038381166001600160a01b0319831681179093556040519116919082907f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0905f90a35050565b5f8281526007602052604090205482906001600160a01b03166120245760405162461bcd60e51b815260040161055b906133c7565b3361202e846109ce565b6001600160a01b0316146120765760405162461bcd60e51b815260206004820152600f60248201526e2727aa2faa27a5a2a72fa7aba722a960891b604482015260640161055b565b6001600160a01b0382166120bc5760405162461bcd60e51b815260206004820152600d60248201526c1554d15497d491545552549151609a1b604482015260640161055b565b5f838152600d602090815260408083206001600160a01b038616845290915290205460ff1661100d575f838152600d602090815260408083206001600160a01b038616808552908352818420805460ff19166001908117909155878552600c845282852080549182018155855292842090920180546001600160a01b0319168317905551859233917f8a1c60ca1a16acd72d841a74fa5905de3938132b0b2ff6cb385a7e69af345fc99190a4505050565b6004545f906001600160a01b031633146121995760405162461bcd60e51b815260040161055b906133f0565b6001600160a01b0388166121bf5760405162461bcd60e51b815260040161055b906136bd565b5f84900361220b5760405162461bcd60e51b81526020600482015260196024820152781253951153131251d1539517d110551057d491545552549151603a1b604482015260640161055b565b5f8690036122545760405162461bcd60e51b8152602060048201526016602482015275115390d4965415115117d5549257d49154555254915160521b604482015260640161055b565b60068054905f61226383613c2b565b909155505f81815260076020908152604080832080546001600160a01b0319166001600160a01b038e1690811790915583526008909152812080549293506001929091906122b2908490613c43565b90915550505f8181526010602052604090206122cf8789836134cd565b505f5b848110156122f8576122f082878784818110610e4057610e4061343b565b6001016122d2565b5061234b8160405180602001604052805f81525089898080601f0160208091040260200160405190810160405280939291908181526020018383808284375f920191909152508b92508a91506125449050565b5060405181906001600160a01b038a16905f907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef908290a46040518181526001600160a01b038916905f907f0ea8df787dde63a7bdc34d17097adf25749a3521f660e92dabdff8d6ee91d18a9060200160405180910390a384845f8181106123d5576123d561343b565b90506020028101906123e79190613582565b60200135886001600160a01b0316827f278e1e66ac0f9a37f4a1216a858aca2008bd57ac977c3f8b41f84b8c0bf3d0d78a8a6040516124279291906135c8565b60405180910390a481156124675780886001600160a01b03165f516020613f005f395f51905f52858560405161245e929190613658565b60405180910390a35b979650505050505050565b60208101356124b85760405162461bcd60e51b81526020600482015260126024820152711110551057d21054d217d49154555254915160721b604482015260640161055b565b6124c28180613dcb565b90505f036125125760405162461bcd60e51b815260206004820152601960248201527f444154415f4445534352495054494f4e5f524551554952454400000000000000604482015260640161055b565b5f828152600e6020908152604082208054600181018255908352912082916002020161253e8282613e0d565b50505050565b61254c612d29565b5f6001831161255b575f612585565b8383600181811061256e5761256e61343b565b90506020028101906125809190613582565b602001355b90505f60028411612596575f6125c0565b848460028181106125a9576125a961343b565b90506020028101906125bb9190613582565b602001355b60408051610100810182525f8b8152600f60205291909120549192509081906125ea906001613c43565b815260200188815260200187815260200186865f81811061260d5761260d61343b565b905060200281019061261f9190613582565b60209081013582528181018590526040808301859052426060840152436080909301929092525f8b8152600f8252918220805460018181018355918452928290208451600890940201928355908301519295508592908201906126829082613d25565b50604082015160028201906126979082613d25565b50606082015181600301556080820151816004015560a0820151816005015560c0820151816006015560e082015181600701555050505095945050505050565b5f5f6126e2836109ce565b9050806001600160a01b0316846001600160a01b0316148061271c57505f838152600960205260409020546001600160a01b038581169116145b8061274b57506001600160a01b038082165f908152600a602090815260408083209388168352929052205460ff165b949350505050565b600554604051636fb1808b60e11b81526060915f916001600160a01b039091169063df6301169061278a9087908790600401613856565b5f604051808303815f875af11580156127a5573d5f5f3e3d5ffd5b505050506040513d5f823e601f3d908101601f191682016040526127cc9190810190613a5a565b5f868152600e60205260409020548151919250146128235760405162461bcd60e51b81526020600482015260146024820152730a0a49e9e8cbe869eaa9ca8be9a92a69a82a886960631b604482015260640161055b565b80516001600160401b0381111561283c5761283c61344f565b60405190808252806020026020018201604052801561286f57816020015b606081526020019060019003908161285a5790505b5091505f5b8151811015612a08575f868152600e6020526040902080548290811061289c5761289c61343b565b905f5260205f209060020201600101548282815181106128be576128be61343b565b60200260200101515f01511461290b5760405162461bcd60e51b815260206004820152601260248201527108882a882be9082a690be9a92a69a82a886960731b604482015260640161055b565b5f5f1b8282815181106129205761292061343b565b602002602001015160200151036129725760405162461bcd60e51b8152602060048201526016602482015275139155d7d110551057d21054d217d49154555254915160521b604482015260640161055b565b8181815181106129845761298461343b565b602002602001015160200151600e5f8881526020019081526020015f2082815481106129b2576129b261343b565b905f5260205f209060020201600101819055508181815181106129d7576129d761343b565b6020026020010151604001518382815181106129f5576129f561343b565b6020908102919091010152600101612874565b50509392505050565b5f818152600c60205260408120905b8154811015612a87575f838152600d6020526040812083548290859085908110612a4c57612a4c61343b565b5f918252602080832091909101546001600160a01b031683528201929092526040019020805460ff1916911515919091179055600101612a20565b505f828152600c60205260408120612a9e91612d85565b5050565b5f81815260096020908152604080832080546001600160a01b03191690556001600160a01b038616835260089091528120805460019290612ae4908490613428565b90915550506001600160a01b0382165f908152600860205260408120805460019290612b11908490613c43565b90915550505f8181526007602052604080822080546001600160a01b0319166001600160a01b0386811691821790925591518493918716917fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef91a4505050565b612b79612d29565b5f848152600e60205260408120549060018211612b96575f612bc7565b5f868152600e6020526040902080546001908110612bb657612bb661343b565b905f5260205f209060020201600101545b90505f60028311612bd8575f612c09565b5f878152600e6020526040902080546002908110612bf857612bf861343b565b905f5260205f209060020201600101545b60408051610100810182525f8a8152600f6020529190912054919250908190612c33906001613c43565b8152602001878152602001868152602001600e5f8a81526020019081526020015f205f81548110612c6657612c6661343b565b5f9182526020808320600160029093020182015484528381018790526040808501879052426060860152436080909501949094528b8352600f8152928220805480830182559083529183902084516008909302019182559183015192965086929091820190612cd59082613d25565b5060408201516002820190612cea9082613d25565b50606082015181600301556080820151816004015560a0820151816005015560c0820151816006015560e0820151816007015550505050509392505050565b6040518061010001604052805f815260200160608152602001606081526020015f81526020015f81526020015f81526020015f81526020015f81525090565b5080545f8255600202905f5260205f2090612d839190612d9d565b565b5080545f8255905f5260205f2090612d839190612dc6565b5f5b8082111561100d578083015f612db58282612ddd565b600182015f90555050600201612d9f565b5f5b8082111561100d575f81840155600101612dc8565b508054612de990613395565b5f825580601f10612df8575050565b601f0160209004905f5260205f2090612d839190612dc6565b5f81518084528060208401602086015e5f602082860101526020601f19601f83011685010191505092915050565b602081525f612e516020830184612e11565b9392505050565b5f60208284031215612e68575f5ffd5b5035919050565b6001600160a01b0381168114612e83575f5ffd5b50565b5f5f60408385031215612e97575f5ffd5b8235612ea281612e6f565b946020939093013593505050565b5f60208284031215612ec0575f5ffd5b8135612e5181612e6f565b602080825282518282018190525f918401906040840190835b81811015612f0b5783516001600160a01b0316835260209384019390920191600101612ee4565b509095945050505050565b5f5f5f60608486031215612f28575f5ffd5b8335612f3381612e6f565b92506020840135612f4381612e6f565b929592945050506040919091013590565b5f602082016020835280845180835260408501915060408160051b8601019250602086015f5b82811015612fbf57603f198786030184528151805160408752612fa06040880182612e11565b6020928301519783019790975250938401939190910190600101612f7a565b50929695505050505050565b5f5f60408385031215612fdc575f5ffd5b50508035926020909101359150565b60208152815160208201525f60208301516101006040840152613012610120840182612e11565b90506040840151601f1984830301606085015261302f8282612e11565b91505060608401516080840152608084015160a084015260a084015160c084015260c084015160e084015260e08401516101008401528091505092915050565b5f5f83601f84011261307f575f5ffd5b5081356001600160401b03811115613095575f5ffd5b6020830191508360208285010111156130ac575f5ffd5b9250929050565b5f5f83601f8401126130c3575f5ffd5b5081356001600160401b038111156130d9575f5ffd5b6020830191508360208260051b85010111156130ac575f5ffd5b5f5f5f5f5f5f5f5f5f60a08a8c03121561310b575f5ffd5b8935985060208a01356001600160401b03811115613127575f5ffd5b6131338c828d0161306f565b90995097505060408a01356001600160401b03811115613151575f5ffd5b61315d8c828d0161306f565b90975095505060608a01356001600160401b0381111561317b575f5ffd5b6131878c828d016130b3565b90955093505060808a01356001600160401b038111156131a5575f5ffd5b6131b18c828d016130b3565b915080935050809150509295985092959850929598565b5f5f602083850312156131d9575f5ffd5b82356001600160401b038111156131ee575f5ffd5b6131fa8582860161306f565b90969095509350505050565b5f5f60408385031215613217575f5ffd5b823561322281612e6f565b915060208301358015158114613236575f5ffd5b809150509250929050565b5f5f5f5f60608587031215613254575f5ffd5b843561325f81612e6f565b93506020850135925060408501356001600160401b03811115613280575f5ffd5b61328c878288016130b3565b95989497509550505050565b5f5f604083850312156132a9575f5ffd5b82359150602083013561323681612e6f565b5f5f604083850312156132cc575f5ffd5b82356132d781612e6f565b9150602083013561323681612e6f565b5f5f5f5f5f5f5f6080888a0312156132fd575f5ffd5b873561330881612e6f565b965060208801356001600160401b03811115613322575f5ffd5b61332e8a828b0161306f565b90975095505060408801356001600160401b0381111561334c575f5ffd5b6133588a828b016130b3565b90955093505060608801356001600160401b03811115613376575f5ffd5b6133828a828b016130b3565b989b979a50959850939692959293505050565b600181811c908216806133a957607f821691505b60208210810361057e57634e487b7160e01b5f52602260045260245ffd5b6020808252600f908201526e1513d2d15397d393d517d193d55391608a1b604082015260600190565b6020808252600a908201526927a7262cafa7aba722a960b11b604082015260600190565b634e487b7160e01b5f52601160045260245ffd5b81810381811115611f2757611f27613414565b634e487b7160e01b5f52603260045260245ffd5b634e487b7160e01b5f52604160045260245ffd5b601f82111561100d578282111561100d57805f5260205f20601f840160051c602085101561348e57505f5b90810190601f840160051c035f5b818110156134b1575f8382015560010161349c565b505050505050565b5f19600383901b1c191660019190911b1790565b6001600160401b038311156134e4576134e461344f565b6134f8836134f28354613395565b83613463565b5f601f841160018114613524575f85156135125750838201355b61351c86826134b9565b84555061357b565b5f83815260208120601f198716915b828110156135535786850135825560209485019460019092019101613533565b508682101561356f575f1960f88860031b161c19848701351681555b505060018560011b0183555b5050505050565b5f8235603e19833603018112613596575f5ffd5b9190910192915050565b81835281816020850137505f828201602090810191909152601f909101601f19169091010190565b602081525f61274b6020830184866135a0565b608081525f6135ee60808301888a6135a0565b82810360208401526136018187896135a0565b6040840195909552505060600152949350505050565b5f5f8335601e1984360301811261362c575f5ffd5b83016020810192503590506001600160401b0381111561364a575f5ffd5b8036038213156130ac575f5ffd5b602080825281018290525f6040600584901b8301810190830185835b868110156136b157858403603f1901835261368f8289613617565b61369a8682846135a0565b955050506020928301929190910190600101613674565b50919695505050505050565b602080825260129082015271149150d2541251539517d49154555254915160721b604082015260600190565b5f602082016020835280845180835260408501915060408160051b8601019250602086015f5b82811015612fbf57603f1987860301845261372b858351612e11565b9450602093840193919091019060010161370f565b634e487b7160e01b5f52603160045260245ffd5b5f823560de19833603018112613768575f5ffd5b90910192915050565b6002811061378d57634e487b7160e01b5f52602160045260245ffd5b9052565b5f8135600281106137a0575f5ffd5b6137aa8482613771565b5060208281013590840152604080830135908401526137cc6060830183613617565b60e060608601526137e160e0860182846135a0565b9150506137f16080840184613617565b85830360808701526138048382846135a0565b9250505061381560a0840184613617565b85830360a08701526138288382846135a0565b9250505061383960c0840184613617565b85830360c087015261384c8382846135a0565b9695505050505050565b602080825281018290525f6040600584901b830181019083018583603e1936839003015b8782101561397957868503603f190184528235818112613898575f5ffd5b8901803536829003609e190181126138ae575f5ffd5b604080885290820180358883015260208101356060890152906138d390820182613617565b60a060808a01526138e860e08a0182846135a0565b9150506138f86060830183613617565b898303603f190160a08b015261390f8382846135a0565b925050506139206080830183613617565b898303603f190160c08b015292506139398284836135a0565b9250505061394a6020830183613754565b9150868103602088015261395e8183613791565b9650505060208301925060208401935060018201915061387a565b5092979650505050505050565b60405161010081016001600160401b03811182821017156139a9576139a961344f565b60405290565b604051601f8201601f191681016001600160401b03811182821017156139d7576139d761344f565b604052919050565b5f82601f8301126139ee575f5ffd5b81516001600160401b03811115613a0757613a0761344f565b613a1a601f8201601f19166020016139af565b818152846020838601011115613a2e575f5ffd5b8160208501602083015e5f918101602001919091529392505050565b8051613a5581612e6f565b919050565b5f60208284031215613a6a575f5ffd5b81516001600160401b03811115613a7f575f5ffd5b8201601f81018413613a8f575f5ffd5b80516001600160401b03811115613aa857613aa861344f565b8060051b613ab8602082016139af565b91825260208184018101929081019087841115613ad3575f5ffd5b6020850192505b838310156124675782516001600160401b03811115613af7575f5ffd5b8501610100818a03601f19011215613b0d575f5ffd5b613b15613986565b602082810151825260408301519082015260608201516001600160401b03811115613b3e575f5ffd5b613b4d8b6020838601016139df565b60408301525060808201516001600160401b03811115613b6b575f5ffd5b613b7a8b6020838601016139df565b60608301525060a08201516001600160401b03811115613b98575f5ffd5b613ba78b6020838601016139df565b608083015250613bb960c08301613a4a565b60a082015260e08201516001600160401b03811115613bd6575f5ffd5b613be58b6020838601016139df565b60c0830152506101008201516001600160401b03811115613c04575f5ffd5b613c138b6020838601016139df565b60e08301525083525060209283019290910190613ada565b5f60018201613c3c57613c3c613414565b5060010190565b80820180821115611f2757611f27613414565b818103613c61575050565b613c6b8254613395565b6001600160401b03811115613c8257613c8261344f565b613c9681613c908454613395565b84613463565b5f601f821160018114613cc2575f8315613cb05750848201545b613cba84826134b9565b85555061357b565b5f8581526020808220868352908220601f198616925b83811015613cf85782860154825560019586019590910190602001613cd8565b5085831015613d1557818501545f19600388901b60f8161c191681555b5050505050600190811b01905550565b81516001600160401b03811115613d3e57613d3e61344f565b613d4c81613c908454613395565b6020601f821160018114613d70575f8315613cb0575084820151613cba84826134b9565b5f84815260208120601f198516915b82811015613d9f5787850151825560209485019460019092019101613d7f565b5084821015613dbc57868401515f19600387901b60f8161c191681555b50505050600190811b01905550565b5f5f8335601e19843603018112613de0575f5ffd5b8301803591506001600160401b03821115613df9575f5ffd5b6020019150368190038213156130ac575f5ffd5b8135601e19833603018112613e20575f5ffd5b820180356001600160401b0381118015613e38575f5ffd5b813603602084011315613e49575f5ffd5b5f905050613e6181613e5b8554613395565b85613463565b5f601f821160018114613e90575f8315613e7e5750838201602001355b613e8884826134b9565b865550613eec565b5f85815260208120601f198516915b82811015613ec157602085880181013583559485019460019092019101613e9f565b5084821015613ee0575f1960f88660031b161c19602085880101351681555b505060018360011b0185555b505050506020919091013560019091015556fe77ac1306adadb66d303dd0baa0534083040b337a1212922215a3ccbaf6fec56ca26469706673582212209cedfe396a934b5da0ddec02973655cb06603dbce5998d0fcdea97948dda38ab64736f6c63430008230033";
