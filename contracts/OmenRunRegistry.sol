// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract OmenRunRegistry {
    struct RunAnchor {
        address anchorer;
        bytes32 manifestRoot;
        string manifestUri;
        uint256 anchoredAt;
        uint256 blockNumber;
    }

    mapping(string runId => RunAnchor anchor) private anchors;

    event RunAnchored(
        string indexed runId,
        bytes32 indexed manifestRoot,
        string manifestUri,
        address indexed anchorer,
        uint256 anchoredAt
    );

    function anchorRun(
        string calldata runId,
        bytes32 manifestRoot,
        string calldata manifestUri
    ) external {
        if (bytes(runId).length == 0) {
            revert("RUN_ID_REQUIRED");
        }
        if (manifestRoot == bytes32(0)) {
            revert("MANIFEST_ROOT_REQUIRED");
        }
        if (bytes(manifestUri).length == 0) {
            revert("MANIFEST_URI_REQUIRED");
        }

        anchors[runId] = RunAnchor({
            anchorer: msg.sender,
            manifestRoot: manifestRoot,
            manifestUri: manifestUri,
            anchoredAt: block.timestamp,
            blockNumber: block.number
        });

        emit RunAnchored(runId, manifestRoot, manifestUri, msg.sender, block.timestamp);
    }

    function getRunAnchor(string calldata runId) external view returns (RunAnchor memory) {
        return anchors[runId];
    }
}
