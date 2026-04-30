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

export const omenAgentInftBytecode = "0x60806040526001600655348015610014575f5ffd5b5060405161352b38038061352b83398101604081905261003391610217565b6001600160a01b0382166100825760405162461bcd60e51b8152602060048201526011602482015270159154925192515497d491545552549151607a1b60448201526064015b60405180910390fd5b6001600160a01b0381166100c95760405162461bcd60e51b815260206004820152600e60248201526d13d5d3915497d49154555254915160921b6044820152606401610079565b5f6100d48782610380565b5060016100e18682610380565b5060026100ee8582610380565b5060036100fb8482610380565b50600580546001600160a01b038085166001600160a01b0319928316179092556004805492841692909116821790556040515f907f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0908290a350505050505061043e565b634e487b7160e01b5f52604160045260245ffd5b5f82601f830112610182575f5ffd5b81516001600160401b0381111561019b5761019b61015f565b604051601f8201601f19908116603f011681016001600160401b03811182821017156101c9576101c961015f565b6040528181528382016020018510156101e0575f5ffd5b8160208501602083015e5f918101602001919091529392505050565b80516001600160a01b0381168114610212575f5ffd5b919050565b5f5f5f5f5f5f60c0878903121561022c575f5ffd5b86516001600160401b03811115610241575f5ffd5b61024d89828a01610173565b602089015190975090506001600160401b0381111561026a575f5ffd5b61027689828a01610173565b604089015190965090506001600160401b03811115610293575f5ffd5b61029f89828a01610173565b606089015190955090506001600160401b038111156102bc575f5ffd5b6102c889828a01610173565b9350506102d7608088016101fc565b91506102e560a088016101fc565b90509295509295509295565b600181811c9082168061030557607f821691505b60208210810361032357634e487b7160e01b5f52602260045260245ffd5b50919050565b601f82111561037b578282111561037b57805f5260205f20601f840160051c602085101561035457505f5b90810190601f840160051c035f5b81811015610377575f83820155600101610362565b5050505b505050565b81516001600160401b038111156103995761039961015f565b6103ad816103a784546102f1565b84610329565b6020601f8211600181146103df575f83156103c85750848201515b5f19600385901b1c1916600184901b178455610437565b5f84815260208120601f198516915b8281101561040e57878501518255602094850194600190920191016103ee565b508482101561042b57868401515f19600387901b60f8161c191681555b505060018360011b0184555b5050505050565b6130e08061044b5f395ff3fe608060405234801561000f575f5ffd5b50600436106101bb575f3560e01c806398bd57de116100f3578063e734737511610093578063e985e9c51161006e578063e985e9c5146103b6578063f2fde38b146103d9578063fa83d14e146103ec578063fd08bca9146103ff575f5ffd5b8063e734737514610393578063e8a3d4851461039b578063e915c38a146103a3575f5ffd5b8063c3612ef7116100ce578063c3612ef71461035a578063c394e8931461036d578063c87b56dd14610380578063dfadc4ff14610380575f5ffd5b806398bd57de14610321578063a22cb46514610334578063b065487314610347575f5ffd5b8063393df2161161015e57806370a082311161013957806370a08231146102d25780638da5cb5b146102f3578063938e3d7b1461030657806395d89b4114610319575f5ffd5b8063393df2161461028c5780635437988d146102ac5780636352211e146102bf575f5ffd5b80630e592fdd116101995780630e592fdd1461021d5780631aeb542f1461024857806323b872dd146102685780632b7ac3f31461027b575f5ffd5b806306fdde03146101bf578063081812fc146101dd578063095ea7b314610208575b5f5ffd5b6101c7610412565b6040516101d49190612159565b60405180910390f35b6101f06101eb366004612172565b6104a1565b6040516001600160a01b0390911681526020016101d4565b61021b6102163660046121a0565b6104ff565b005b6101f061022b3660046121ca565b6001600160a01b039081165f908152600b60205260409020541690565b61025b610256366004612172565b610671565b6040516101d491906121e5565b61021b610276366004612230565b610711565b6005546001600160a01b03166101f0565b61029f61029a366004612172565b610840565b6040516101d4919061226e565b61021b6102ba3660046121ca565b610975565b6101f06102cd366004612172565b610a0b565b6102e56102e03660046121ca565b610a5c565b6040519081526020016101d4565b6004546101f0906001600160a01b031681565b61021b610314366004612329565b610abd565b6101c7610af9565b61021b61032f3660046121ca565b610b08565b61021b610342366004612367565b610b5e565b61021b6103553660046123e2565b610c16565b61021b610368366004612439565b610d4a565b61021b61037b366004612329565b610f61565b6101c761038e366004612172565b610f98565b6101c7611062565b6101c76110ee565b6102e56103b13660046123e2565b6110fb565b6103c96103c436600461245c565b611614565b60405190151581526020016101d4565b61021b6103e73660046121ca565b611643565b61021b6103fa366004612439565b611705565b6102e561040d366004612488565b611883565b60605f805461042090612536565b80601f016020809104026020016040519081016040528092919081815260200182805461044c90612536565b80156104975780601f1061046e57610100808354040283529160200191610497565b820191905f5260205f20905b81548152906001019060200180831161047a57829003601f168201915b5050505050905090565b5f8181526007602052604081205482906001600160a01b03166104df5760405162461bcd60e51b81526004016104d690612568565b60405180910390fd5b5f838152600960205260409020546001600160a01b031691505b50919050565b5f8181526007602052604090205481906001600160a01b03166105345760405162461bcd60e51b81526004016104d690612568565b5f61053e83610a0b565b9050806001600160a01b0316846001600160a01b0316036105955760405162461bcd60e51b815260206004820152601160248201527020a8282927ab20a62faa27afa7aba722a960791b60448201526064016104d6565b336001600160a01b038216148015906105d157506001600160a01b0381165f908152600a6020908152604080832033845290915290205460ff16155b156106155760405162461bcd60e51b81526020600482015260146024820152731393d517d054141493d5915117d193d497d0531360621b60448201526064016104d6565b5f8381526009602052604080822080546001600160a01b0319166001600160a01b0388811691821790925591518693918516917f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92591a450505050565b5f8181526007602052604090205460609082906001600160a01b03166106a95760405162461bcd60e51b81526004016104d690612568565b5f838152600c60209081526040918290208054835181840281018401909452808452909183018282801561070457602002820191905f5260205f20905b81546001600160a01b031681526001909101906020018083116106e6575b5050505050915050919050565b5f8181526007602052604090205481906001600160a01b03166107465760405162461bcd60e51b81526004016104d690612568565b6107503383611c60565b61076c5760405162461bcd60e51b81526004016104d690612591565b836001600160a01b031661077f83610a0b565b6001600160a01b0316146107c65760405162461bcd60e51b815260206004820152600e60248201526d232927a6afa727aa2fa7aba722a960911b60448201526064016104d6565b6001600160a01b0383166107ec5760405162461bcd60e51b81526004016104d6906125b7565b6107f582611cdc565b610800848484611d6d565b826001600160a01b0316846001600160a01b03165f51602061308b5f395f51905f528460405161083291815260200190565b60405180910390a350505050565b5f8181526007602052604090205460609082906001600160a01b03166108785760405162461bcd60e51b81526004016104d690612568565b5f838152600e6020908152604080832080548251818502810185019093528083529193909284015b82821015610969578382905f5260205f2090600202016040518060400160405290815f820180546108d090612536565b80601f01602080910402602001604051908101604052809291908181526020018280546108fc90612536565b80156109475780601f1061091e57610100808354040283529160200191610947565b820191905f5260205f20905b81548152906001019060200180831161092a57829003601f168201915b50505050508152602001600182015481525050815260200190600101906108a0565b50505050915050919050565b6004546001600160a01b0316331461099f5760405162461bcd60e51b81526004016104d6906125e3565b6001600160a01b0381166109e95760405162461bcd60e51b8152602060048201526011602482015270159154925192515497d491545552549151607a1b60448201526064016104d6565b600580546001600160a01b0319166001600160a01b0392909216919091179055565b5f8181526007602052604081205482906001600160a01b0316610a405760405162461bcd60e51b81526004016104d690612568565b50505f908152600760205260409020546001600160a01b031690565b5f6001600160a01b038216610aa25760405162461bcd60e51b815260206004820152600c60248201526b5a45524f5f4144445245535360a01b60448201526064016104d6565b506001600160a01b03165f9081526008602052604090205490565b6004546001600160a01b03163314610ae75760405162461bcd60e51b81526004016104d6906125e3565b6003610af4828483612685565b505050565b60606001805461042090612536565b335f818152600b602052604080822080546001600160a01b0319166001600160a01b03861690811790915590519092917f57a5f7ce01affd949c0efd1484fd811d31ff5c8ca21c7006f5f4de7292f26de491a350565b336001600160a01b03831603610bab5760405162461bcd60e51b815260206004820152601260248201527120a8282927ab20a62faa27afa1a0a62622a960711b60448201526064016104d6565b335f818152600a602090815260408083206001600160a01b03871680855290835292819020805460ff191686151590811790915590519081529192917f17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31910160405180910390a35050565b5f8381526007602052604090205483906001600160a01b0316610c4b5760405162461bcd60e51b81526004016104d690612568565b5f610c5585610a0b565b9050610c613386611c60565b610c7d5760405162461bcd60e51b81526004016104d690612591565b6001600160a01b038616610ca35760405162461bcd60e51b81526004016104d6906125b7565b5f610caf868686611e3c565b9050610cba86611cdc565b610cc5828888611d6d565b866001600160a01b0316826001600160a01b03165f51602061308b5f395f51905f5288604051610cf791815260200190565b60405180910390a385876001600160a01b03167f77ac1306adadb66d303dd0baa0534083040b337a1212922215a3ccbaf6fec56c83604051610d39919061273a565b60405180910390a350505050505050565b5f8281526007602052604090205482906001600160a01b0316610d7f5760405162461bcd60e51b81526004016104d690612568565b33610d8984610a0b565b6001600160a01b031614610dd15760405162461bcd60e51b815260206004820152600f60248201526e2727aa2faa27a5a2a72fa7aba722a960891b60448201526064016104d6565b5f838152600d602090815260408083206001600160a01b038616845290915290205460ff1615610af4575f838152600d602090815260408083206001600160a01b03861684528252808320805460ff19169055858352600c9091528120905b8154811015610f2357836001600160a01b0316828281548110610e5557610e55612791565b5f918252602090912001546001600160a01b031603610f1b5781548290610e7e906001906127b9565b81548110610e8e57610e8e612791565b905f5260205f20015f9054906101000a90046001600160a01b0316828281548110610ebb57610ebb612791565b905f5260205f20015f6101000a8154816001600160a01b0302191690836001600160a01b0316021790555081805480610ef657610ef66127cc565b5f8281526020902081015f1990810180546001600160a01b0319169055019055610f23565b600101610e30565b5060405184906001600160a01b0385169033907fd1662978c81e15f621e7a38524048493c6e86d91a24a29619d164bef0a8d0a98905f90a450505050565b6004546001600160a01b03163314610f8b5760405162461bcd60e51b81526004016104d6906125e3565b6002610af4828483612685565b5f8181526007602052604090205460609082906001600160a01b0316610fd05760405162461bcd60e51b81526004016104d690612568565b5f838152600f602052604090208054610fe890612536565b80601f016020809104026020016040519081016040528092919081815260200182805461101490612536565b80156107045780601f1061103657610100808354040283529160200191610704565b820191905f5260205f20905b815481529060010190602001808311611042575093979650505050505050565b6002805461106f90612536565b80601f016020809104026020016040519081016040528092919081815260200182805461109b90612536565b80156110e65780601f106110bd576101008083540402835291602001916110e6565b820191905f5260205f20905b8154815290600101906020018083116110c957829003601f168201915b505050505081565b6003805461106f90612536565b5f8381526007602052604081205484906001600160a01b03166111305760405162461bcd60e51b81526004016104d690612568565b61113a3386611c60565b6111565760405162461bcd60e51b81526004016104d690612591565b6001600160a01b03861661117c5760405162461bcd60e51b81526004016104d6906125b7565b600554604051636fb1808b60e11b81525f916001600160a01b03169063df630116906111ae908890889060040161294b565b5f604051808303815f875af11580156111c9573d5f5f3e3d5ffd5b505050506040513d5f823e601f3d908101601f191682016040526111f09190810190612b4f565b5f878152600e60205260409020548151919250146112475760405162461bcd60e51b81526020600482015260146024820152730a0a49e9e8cbe869eaa9ca8be9a92a69a82a886960631b60448201526064016104d6565b60068054905f61125683612d20565b909155505f81815260076020908152604080832080546001600160a01b0319166001600160a01b038d1690811790915583526008909152812080549295506001929091906112a5908490612d38565b90915550505f868152600f60205260408082208583529120906112c89082612d4b565b505f81516001600160401b038111156112e3576112e3612607565b60405190808252806020026020018201604052801561131657816020015b60608152602001906001900390816113015790505b5090505f5b8251811015611514575f888152600e6020526040902080548290811061134357611343612791565b905f5260205f2090600202016001015483828151811061136557611365612791565b60200260200101515f0151146113b25760405162461bcd60e51b815260206004820152601260248201527108882a882be9082a690be9a92a69a82a886960731b60448201526064016104d6565b5f858152600e6020526040808220815180830183528b8452919092208054829190859081106113e3576113e3612791565b905f5260205f2090600202015f0180546113fc90612536565b80601f016020809104026020016040519081016040528092919081815260200182805461142890612536565b80156114735780601f1061144a57610100808354040283529160200191611473565b820191905f5260205f20905b81548152906001019060200180831161145657829003601f168201915b5050505050815260200185848151811061148f5761148f612791565b60209081029190910181015181015190915282546001810184555f938452922081519192600202019081906114c49082612e1a565b506020820151816001015550508281815181106114e3576114e3612791565b60200260200101516040015182828151811061150157611501612791565b602090810291909101015260010161131b565b5060405184906001600160a01b038a16905f907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef908290a46040518481526001600160a01b038916905f905f51602061308b5f395f51905f529060200160405180910390a383877f40b442ee2bb535802063305b95f127b5101e5fce261a5dec9379683eaaad8cdb6115a58a610a0b565b604080516001600160a01b039283168152918d1660208301520160405180910390a383886001600160a01b03167f77ac1306adadb66d303dd0baa0534083040b337a1212922215a3ccbaf6fec56c83604051611601919061273a565b60405180910390a3505050949350505050565b6001600160a01b038083165f908152600a602090815260408083209385168352929052205460ff165b92915050565b6004546001600160a01b0316331461166d5760405162461bcd60e51b81526004016104d6906125e3565b6001600160a01b0381166116b45760405162461bcd60e51b815260206004820152600e60248201526d13d5d3915497d49154555254915160921b60448201526064016104d6565b600480546001600160a01b038381166001600160a01b0319831681179093556040519116919082907f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0905f90a35050565b5f8281526007602052604090205482906001600160a01b031661173a5760405162461bcd60e51b81526004016104d690612568565b3361174484610a0b565b6001600160a01b03161461178c5760405162461bcd60e51b815260206004820152600f60248201526e2727aa2faa27a5a2a72fa7aba722a960891b60448201526064016104d6565b6001600160a01b0382166117d25760405162461bcd60e51b815260206004820152600d60248201526c1554d15497d491545552549151609a1b60448201526064016104d6565b5f838152600d602090815260408083206001600160a01b038616845290915290205460ff16610af4575f838152600d602090815260408083206001600160a01b038616808552908352818420805460ff19166001908117909155878552600c845282852080549182018155855292842090920180546001600160a01b0319168317905551859233917f8a1c60ca1a16acd72d841a74fa5905de3938132b0b2ff6cb385a7e69af345fc99190a4505050565b6004545f906001600160a01b031633146118af5760405162461bcd60e51b81526004016104d6906125e3565b6001600160a01b0388166118d55760405162461bcd60e51b81526004016104d6906125b7565b5f8490036119255760405162461bcd60e51b815260206004820152601960248201527f494e54454c4c4947454e545f444154415f52455155495245440000000000000060448201526064016104d6565b5f86900361196e5760405162461bcd60e51b8152602060048201526016602482015275115390d4965415115117d5549257d49154555254915160521b60448201526064016104d6565b60068054905f61197d83612d20565b909155505f81815260076020908152604080832080546001600160a01b0319166001600160a01b038e1690811790915583526008909152812080549293506001929091906119cc908490612d38565b90915550505f818152600f602052604090206119e9878983612685565b505f5b84811015611b39575f868683818110611a0757611a07612791565b9050602002810190611a199190612ec0565b6020013503611a5f5760405162461bcd60e51b81526020600482015260126024820152711110551057d21054d217d49154555254915160721b60448201526064016104d6565b858582818110611a7157611a71612791565b9050602002810190611a839190612ec0565b611a8d9080612ede565b90505f03611add5760405162461bcd60e51b815260206004820152601960248201527f444154415f4445534352495054494f4e5f52455155495245440000000000000060448201526064016104d6565b5f828152600e60205260409020868683818110611afc57611afc612791565b9050602002810190611b0e9190612ec0565b81546001810183555f9283526020909220909160020201611b2f8282612f20565b50506001016119ec565b5060405181906001600160a01b038a16905f907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef908290a46040518181526001600160a01b038916905f905f51602061308b5f395f51905f529060200160405180910390a384845f818110611bb057611bb0612791565b9050602002810190611bc29190612ec0565b60200135886001600160a01b0316827f278e1e66ac0f9a37f4a1216a858aca2008bd57ac977c3f8b41f84b8c0bf3d0d78a8a604051611c02929190613012565b60405180910390a48115611c555780886001600160a01b03167f77ac1306adadb66d303dd0baa0534083040b337a1212922215a3ccbaf6fec56c8585604051611c4c929190613025565b60405180910390a35b979650505050505050565b5f5f611c6b83610a0b565b9050806001600160a01b0316846001600160a01b03161480611ca557505f838152600960205260409020546001600160a01b038581169116145b80611cd457506001600160a01b038082165f908152600a602090815260408083209388168352929052205460ff165b949350505050565b5f818152600c60205260408120905b8154811015611d52575f838152600d6020526040812083548290859085908110611d1757611d17612791565b5f918252602080832091909101546001600160a01b031683528201929092526040019020805460ff1916911515919091179055600101611ceb565b505f828152600c60205260408120611d69916120fa565b5050565b5f81815260096020908152604080832080546001600160a01b03191690556001600160a01b038616835260089091528120805460019290611daf9084906127b9565b90915550506001600160a01b0382165f908152600860205260408120805460019290611ddc908490612d38565b90915550505f8181526007602052604080822080546001600160a01b0319166001600160a01b0386811691821790925591518493918716917fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef91a4505050565b600554604051636fb1808b60e11b81526060915f916001600160a01b039091169063df63011690611e73908790879060040161294b565b5f604051808303815f875af1158015611e8e573d5f5f3e3d5ffd5b505050506040513d5f823e601f3d908101601f19168201604052611eb59190810190612b4f565b5f868152600e6020526040902054815191925014611f0c5760405162461bcd60e51b81526020600482015260146024820152730a0a49e9e8cbe869eaa9ca8be9a92a69a82a886960631b60448201526064016104d6565b80516001600160401b03811115611f2557611f25612607565b604051908082528060200260200182016040528015611f5857816020015b6060815260200190600190039081611f435790505b5091505f5b81518110156120f1575f868152600e60205260409020805482908110611f8557611f85612791565b905f5260205f20906002020160010154828281518110611fa757611fa7612791565b60200260200101515f015114611ff45760405162461bcd60e51b815260206004820152601260248201527108882a882be9082a690be9a92a69a82a886960731b60448201526064016104d6565b5f5f1b82828151811061200957612009612791565b6020026020010151602001510361205b5760405162461bcd60e51b8152602060048201526016602482015275139155d7d110551057d21054d217d49154555254915160521b60448201526064016104d6565b81818151811061206d5761206d612791565b602002602001015160200151600e5f8881526020019081526020015f20828154811061209b5761209b612791565b905f5260205f209060020201600101819055508181815181106120c0576120c0612791565b6020026020010151604001518382815181106120de576120de612791565b6020908102919091010152600101611f5d565b50509392505050565b5080545f8255905f5260205f20906121129190612114565b565b5f5b80821115610af4575f81840155600101612116565b5f81518084528060208401602086015e5f602082860101526020601f19601f83011685010191505092915050565b602081525f61216b602083018461212b565b9392505050565b5f60208284031215612182575f5ffd5b5035919050565b6001600160a01b038116811461219d575f5ffd5b50565b5f5f604083850312156121b1575f5ffd5b82356121bc81612189565b946020939093013593505050565b5f602082840312156121da575f5ffd5b813561216b81612189565b602080825282518282018190525f918401906040840190835b818110156122255783516001600160a01b03168352602093840193909201916001016121fe565b509095945050505050565b5f5f5f60608486031215612242575f5ffd5b833561224d81612189565b9250602084013561225d81612189565b929592945050506040919091013590565b5f602082016020835280845180835260408501915060408160051b8601019250602086015f5b828110156122d957603f1987860301845281518051604087526122ba604088018261212b565b6020928301519783019790975250938401939190910190600101612294565b50929695505050505050565b5f5f83601f8401126122f5575f5ffd5b5081356001600160401b0381111561230b575f5ffd5b602083019150836020828501011115612322575f5ffd5b9250929050565b5f5f6020838503121561233a575f5ffd5b82356001600160401b0381111561234f575f5ffd5b61235b858286016122e5565b90969095509350505050565b5f5f60408385031215612378575f5ffd5b823561238381612189565b915060208301358015158114612397575f5ffd5b809150509250929050565b5f5f83601f8401126123b2575f5ffd5b5081356001600160401b038111156123c8575f5ffd5b6020830191508360208260051b8501011115612322575f5ffd5b5f5f5f5f606085870312156123f5575f5ffd5b843561240081612189565b93506020850135925060408501356001600160401b03811115612421575f5ffd5b61242d878288016123a2565b95989497509550505050565b5f5f6040838503121561244a575f5ffd5b82359150602083013561239781612189565b5f5f6040838503121561246d575f5ffd5b823561247881612189565b9150602083013561239781612189565b5f5f5f5f5f5f5f6080888a03121561249e575f5ffd5b87356124a981612189565b965060208801356001600160401b038111156124c3575f5ffd5b6124cf8a828b016122e5565b90975095505060408801356001600160401b038111156124ed575f5ffd5b6124f98a828b016123a2565b90955093505060608801356001600160401b03811115612517575f5ffd5b6125238a828b016123a2565b989b979a50959850939692959293505050565b600181811c9082168061254a57607f821691505b6020821081036104f957634e487b7160e01b5f52602260045260245ffd5b6020808252600f908201526e1513d2d15397d393d517d193d55391608a1b604082015260600190565b6020808252600c908201526b1393d517d054141493d5915160a21b604082015260600190565b602080825260129082015271149150d2541251539517d49154555254915160721b604082015260600190565b6020808252600a908201526927a7262cafa7aba722a960b11b604082015260600190565b634e487b7160e01b5f52604160045260245ffd5b601f821115610af45782821115610af457805f5260205f20601f840160051c602085101561264657505f5b90810190601f840160051c035f5b81811015612669575f83820155600101612654565b505050505050565b5f19600383901b1c191660019190911b1790565b6001600160401b0383111561269c5761269c612607565b6126b0836126aa8354612536565b8361261b565b5f601f8411600181146126dc575f85156126ca5750838201355b6126d48682612671565b845550612733565b5f83815260208120601f198716915b8281101561270b57868501358255602094850194600190920191016126eb565b5086821015612727575f1960f88860031b161c19848701351681555b505060018560011b0183555b5050505050565b5f602082016020835280845180835260408501915060408160051b8601019250602086015f5b828110156122d957603f1987860301845261277c85835161212b565b94506020938401939190910190600101612760565b634e487b7160e01b5f52603260045260245ffd5b634e487b7160e01b5f52601160045260245ffd5b8181038181111561163d5761163d6127a5565b634e487b7160e01b5f52603160045260245ffd5b5f5f8335601e198436030181126127f5575f5ffd5b83016020810192503590506001600160401b03811115612813575f5ffd5b803603821315612322575f5ffd5b81835281816020850137505f828201602090810191909152601f909101601f19169091010190565b5f823560de1983360301811261285d575f5ffd5b90910192915050565b6002811061288257634e487b7160e01b5f52602160045260245ffd5b9052565b5f813560028110612895575f5ffd5b61289f8482612866565b5060208281013590840152604080830135908401526128c160608301836127e0565b60e060608601526128d660e086018284612821565b9150506128e660808401846127e0565b85830360808701526128f9838284612821565b9250505061290a60a08401846127e0565b85830360a087015261291d838284612821565b9250505061292e60c08401846127e0565b85830360c0870152612941838284612821565b9695505050505050565b602080825281018290525f6040600584901b830181019083018583603e1936839003015b87821015612a6e57868503603f19018452823581811261298d575f5ffd5b8901803536829003609e190181126129a3575f5ffd5b604080885290820180358883015260208101356060890152906129c8908201826127e0565b60a060808a01526129dd60e08a018284612821565b9150506129ed60608301836127e0565b898303603f190160a08b0152612a04838284612821565b92505050612a1560808301836127e0565b898303603f190160c08b01529250612a2e828483612821565b92505050612a3f6020830183612849565b91508681036020880152612a538183612886565b9650505060208301925060208401935060018201915061296f565b5092979650505050505050565b60405161010081016001600160401b0381118282101715612a9e57612a9e612607565b60405290565b604051601f8201601f191681016001600160401b0381118282101715612acc57612acc612607565b604052919050565b5f82601f830112612ae3575f5ffd5b81516001600160401b03811115612afc57612afc612607565b612b0f601f8201601f1916602001612aa4565b818152846020838601011115612b23575f5ffd5b8160208501602083015e5f918101602001919091529392505050565b8051612b4a81612189565b919050565b5f60208284031215612b5f575f5ffd5b81516001600160401b03811115612b74575f5ffd5b8201601f81018413612b84575f5ffd5b80516001600160401b03811115612b9d57612b9d612607565b8060051b612bad60208201612aa4565b91825260208184018101929081019087841115612bc8575f5ffd5b6020850192505b83831015611c555782516001600160401b03811115612bec575f5ffd5b8501610100818a03601f19011215612c02575f5ffd5b612c0a612a7b565b602082810151825260408301519082015260608201516001600160401b03811115612c33575f5ffd5b612c428b602083860101612ad4565b60408301525060808201516001600160401b03811115612c60575f5ffd5b612c6f8b602083860101612ad4565b60608301525060a08201516001600160401b03811115612c8d575f5ffd5b612c9c8b602083860101612ad4565b608083015250612cae60c08301612b3f565b60a082015260e08201516001600160401b03811115612ccb575f5ffd5b612cda8b602083860101612ad4565b60c0830152506101008201516001600160401b03811115612cf9575f5ffd5b612d088b602083860101612ad4565b60e08301525083525060209283019290910190612bcf565b5f60018201612d3157612d316127a5565b5060010190565b8082018082111561163d5761163d6127a5565b818103612d56575050565b612d608254612536565b6001600160401b03811115612d7757612d77612607565b612d8b81612d858454612536565b8461261b565b5f601f821160018114612db7575f8315612da55750848201545b612daf8482612671565b855550612733565b5f8581526020808220868352908220601f198616925b83811015612ded5782860154825560019586019590910190602001612dcd565b5085831015612e0a57818501545f19600388901b60f8161c191681555b5050505050600190811b01905550565b81516001600160401b03811115612e3357612e33612607565b612e4181612d858454612536565b6020601f821160018114612e65575f8315612da5575084820151612daf8482612671565b5f84815260208120601f198516915b82811015612e945787850151825560209485019460019092019101612e74565b5084821015612eb157868401515f19600387901b60f8161c191681555b50505050600190811b01905550565b5f8235603e19833603018112612ed4575f5ffd5b9190910192915050565b5f5f8335601e19843603018112612ef3575f5ffd5b8301803591506001600160401b03821115612f0c575f5ffd5b602001915036819003821315612322575f5ffd5b8135601e19833603018112612f33575f5ffd5b820180356001600160401b0381118015612f4b575f5ffd5b813603602084011315612f5c575f5ffd5b5f905050612f7481612f6e8554612536565b8561261b565b5f601f821160018114612fa3575f8315612f915750838201602001355b612f9b8482612671565b865550612fff565b5f85815260208120601f198516915b82811015612fd457602085880181013583559485019460019092019101612fb2565b5084821015612ff3575f1960f88660031b161c19602085880101351681555b505060018360011b0185555b5050505060209190910135600190910155565b602081525f611cd4602083018486612821565b602080825281018290525f6040600584901b8301810190830185835b8681101561307e57858403603f1901835261305c82896127e0565b613067868284612821565b955050506020928301929190910190600101613041565b5091969550505050505056fe0ea8df787dde63a7bdc34d17097adf25749a3521f660e92dabdff8d6ee91d18aa2646970667358221220187fb7b10bfa1fd8cac22564790b9f66d0275aaaccc81e4f4eff1b108063517164736f6c63430008230033";
