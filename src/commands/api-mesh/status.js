const { Command } = require('@oclif/core');

const logger = require('../../classes/logger');
const { initRequestId, initSdk } = require('../../helpers');
const { getMeshId, getMesh, getMeshDeployments } = require('../../lib/devConsole');
const { ignoreCacheFlag } = require('../../utils');

require('dotenv').config();

class StatusCommand extends Command {
	static flags = {
		ignoreCache: ignoreCacheFlag,
	};

	async run() {
		await initRequestId();
		logger.info(`RequestId: ${global.requestId}`);

		const { flags } = await this.parse(StatusCommand);
		const ignoreCache = await flags.ignoreCache;
		const { imsOrgCode, projectId, workspaceId, workspaceName } = await initSdk({
			ignoreCache,
		});

		let meshId = null;

		try {
			meshId = await getMeshId(imsOrgCode, projectId, workspaceId, workspaceName);
		} catch (err) {
			// API Request failed
			this.log(err.message);
			this.error(
				`Unable to get mesh ID. Please check the details and try again. RequestId: ${global.requestId}`,
			);
		}

		// API Request succeeded, but mesh could not be found
		if (!meshId) {
			this.error(
				`Unable to get mesh status. No mesh found for Org(${imsOrgCode}) -> Project(${projectId}) -> Workspace(${workspaceId}). Check the details and try again.`,
			);
		}

		try {
			const mesh = await getMesh(imsOrgCode, projectId, workspaceId, workspaceName, meshId);
			this.log(''.padEnd(102, '*'));
			await this.displayMeshStatus(mesh, imsOrgCode, projectId, workspaceId);
			this.log(''.padEnd(102, '*'));

			return mesh;
		} catch (err) {
			// Error occurred while fetching/displaying the mesh status
			this.error(
				`Unable to get mesh status. If this error persists, contact support. RequestId: ${global.requestId}`,
			);
		}
	}

	/**
	 * Display the status of the mesh.
	 *
	 * While the mesh is not successfully built, display a message based on the build status.
	 * Once the build is successful, display a message based on the deployment status.
	 * @param mesh
	 * @param imsOrgCode
	 * @param projectId
	 * @param workspaceId
	 * @returns {Promise<void>}
	 */
	async displayMeshStatus(mesh, imsOrgCode, projectId, workspaceId) {
		if (mesh.meshStatus !== 'success') {
			this.displayMeshBuildStatus(mesh);
		} else {
			await this.displayMeshDeploymentStatus(mesh, imsOrgCode, projectId, workspaceId);
		}
	}

	/**
	 * Display the status of the mesh build.
	 *
	 * @param mesh - Mesh data
	 */
	displayMeshBuildStatus(mesh) {
		switch (mesh.meshStatus) {
			case 'pending':
				this.log('Mesh is awaiting processing.');
				break;
			case 'building':
				this.log('Mesh is currently building. Wait a few minutes before checking again.');
				break;
			case 'error':
				this.log('Mesh build has errors.');
				this.log(mesh.error);
				break;
			default:
				this.log('Mesh status is not available. Wait a few minutes and try again.');
				break;
		}
	}

	/**
	 * Display the status of the mesh deployment.
	 *
	 * @param mesh
	 * @param imsOrgCode
	 * @param projectId
	 * @param workspaceId
	 * @returns {Promise<void>}
	 */
	async displayMeshDeploymentStatus(mesh, imsOrgCode, projectId, workspaceId) {
		const meshDeployments = await getMeshDeployments(
			imsOrgCode,
			projectId,
			workspaceId,
			mesh.meshId,
		);

		const meshDeploymentStatus = String(meshDeployments.status).toLowerCase();

		switch (meshDeploymentStatus) {
			case 'provisioning':
				this.log('Currently provisioning your mesh. Wait a few minutes and try again.');
				break;
			case 'de-provisioning':
				this.log('Currently de-provisioning your mesh. Wait a few minutes and try again.');
				break;
			case 'success':
				this.log('Mesh was built successfully.');
				break;
			case 'error':
				this.log('Mesh build has errors.');
				this.log(meshDeployments.error);
				break;
			default:
				this.log('Mesh status is not available. Wait a few minutes and try again.');
				break;
		}
	}
}

StatusCommand.description = 'Get a mesh status with a given meshid.';

module.exports = StatusCommand;
