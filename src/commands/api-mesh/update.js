/*
Copyright 2021 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const { Command } = require('@oclif/command');

const logger = require('../../classes/logger');
const { initSdk, initRequestId, promptConfirm, importFiles } = require('../../helpers');
const {
	ignoreCacheFlag,
	autoConfirmActionFlag,
	envFileFlag,
	secretsFlag,
	checkPlaceholders,
	readFileContents,
	validateAndInterpolateMesh,
	getFilesInMeshConfig,
	interpolateSecrets,
	validateSecretsFile,
	encryptSecrets,
} = require('../../utils');
const { getMeshId, updateMesh, getPublicEncryptionKey } = require('../../lib/devConsole');

class UpdateCommand extends Command {
	static args = [{ name: 'file' }];
	static flags = {
		ignoreCache: ignoreCacheFlag,
		autoConfirmAction: autoConfirmActionFlag,
		env: envFileFlag,
		secrets: secretsFlag,
	};

	async run() {
		await initRequestId();

		logger.info(`RequestId: ${global.requestId}`);

		const { args, flags } = await this.parse(UpdateCommand);

		if (!args.file) {
			this.error('Missing required args. Run aio api-mesh update --help for more info.');

			return;
		}

		const ignoreCache = await flags.ignoreCache;
		const autoConfirmAction = await flags.autoConfirmAction;
		const envFilePath = await flags.env;
		const secretsFilePath = await flags.secrets;

		const {
			imsOrgId,
			imsOrgCode,
			projectId,
			workspaceId,
			orgName,
			projectName,
			workspaceName,
		} = await initSdk({
			ignoreCache,
		});

		//Input the mesh data from the input file
		let inputMeshData = await readFileContents(args.file, this, 'mesh');

		let meshId = null;

		try {
			meshId = await getMeshId(imsOrgCode, projectId, workspaceId);
		} catch (err) {
			this.error(
				`Unable to get mesh ID. Check the details and try again. RequestId: ${global.requestId}`,
			);
		}

		let data;

		if (checkPlaceholders(inputMeshData)) {
			this.log('The provided mesh contains placeholders. Starting mesh interpolation process.');
			data = await validateAndInterpolateMesh(inputMeshData, envFilePath, this);
		} else {
			try {
				data = JSON.parse(inputMeshData);
			} catch (err) {
				this.log(err.message);
				this.error('Input mesh file is not a valid JSON. Check the file provided.');
			}
		}

		let filesList = [];

		try {
			filesList = getFilesInMeshConfig(data, args.file);
		} catch (err) {
			this.log(err.message);
			this.error('Input mesh config is not valid.');
		}

		// if local files are present, import them in files array in meshConfig
		if (filesList.length) {
			try {
				data = await importFiles(data, filesList, args.file, flags.autoConfirmAction);
			} catch (err) {
				this.log(err.message);
				this.error('Unable to import the files in the mesh config. Check the file and try again.');
			}
		}

		// if secrets is present, include that in data.secrets
		if (secretsFilePath) {
			try {
				await validateSecretsFile(secretsFilePath);
				const secretsData = await interpolateSecrets(secretsFilePath, this);
				const publicKey = await getPublicEncryptionKey(imsOrgCode);
				const encryptedSecrets = await encryptSecrets(publicKey, secretsData);
				data.secrets = encryptedSecrets;
			} catch (err) {
				this.log(err.message);
				this.error('Unable to import secrets. Check the file and try again.');
			}
		}

		if (meshId) {
			let shouldContinue = true;

			if (!autoConfirmAction) {
				shouldContinue = await promptConfirm(
					`Are you sure you want to update the mesh: ${meshId}?`,
				);
			}

			if (shouldContinue) {
				try {
					const response = await updateMesh(
						imsOrgCode,
						projectId,
						workspaceId,
						workspaceName,
						orgName,
						projectName,
						meshId,
						data,
					);

					this.log(
						'******************************************************************************************************',
					);
					this.log(
						'Your mesh is being provisioned. Wait a few minutes before checking the status of your mesh %s',
						meshId,
					);
					this.log('To check the status of your mesh, run:');
					this.log('aio api-mesh:status');
					this.log(
						'******************************************************************************************************',
					);

					return response;
				} catch (error) {
					this.log(error.message);

					this.error(
						`Unable to update the mesh. Check the mesh configuration file and try again. If the error persists please contact support. RequestId: ${global.requestId}`,
					);
				}
			} else {
				this.log('Update cancelled');

				return 'Update cancelled';
			}
		} else {
			this.error(
				`Unable to update. No mesh found for Org(${imsOrgId}) -> Project(${projectId}) -> Workspace(${workspaceId}). Please check the details and try again.`,
			);
		}
	}
}

UpdateCommand.description = 'Update a mesh with the given config.';

module.exports = UpdateCommand;
