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

const { Command } = require('@oclif/core');
const {
	portNoFlag,
	debugFlag,
	selectFlag,
	envFileFlag,
	secretsFlag,
	autoConfirmActionFlag,
	readFileContents,
	validateAndInterpolateMesh,
	checkPlaceholders,
	getFilesInMeshConfig,
	validateSecretsFile,
	interpolateSecrets,
} = require('../../utils');
const meshBuilder = require('@adobe-apimesh/mesh-builder');
const fs = require('fs');
const path = require('path');
const {
	initSdk,
	initRequestId,
	importFiles,
	setUpTenantFiles,
	writeSecretsFile,
} = require('../../helpers');
const logger = require('../../classes/logger');
const { getMeshId, getMeshArtifact } = require('../../lib/devConsole');
require('dotenv').config();
const { runServer } = require('../../server');
const { fixPlugins } = require('../../fixPlugins');

const { validateMesh, buildMesh, compileMesh } = meshBuilder.default;

class RunCommand extends Command {
	static summary = 'Run local development server';
	static description = 'Run a local development server that builds and compiles a mesh locally';

	static args = [
		{
			name: 'file',
			description: 'Mesh File',
		},
	];

	static flags = {
		port: portNoFlag,
		debug: debugFlag,
		env: envFileFlag,
		autoConfirmAction: autoConfirmActionFlag,
		select: selectFlag,
		secrets: secretsFlag,
	};

	static enableJsonFlag = true;

	static examples = [];

	async run() {
		await initRequestId();

		logger.info(`RequestId: ${global.requestId}`);

		const { args, flags } = await this.parse(RunCommand);
		const secretsFilePath = await flags.secrets;

		//Initialize the meshId based on
		let meshId = null;

		try {
			//Ensure that current directory includes package.json
			if (fs.existsSync(path.join(process.cwd(), 'package.json'))) {
				//If select flag is present then getMeshId for the specified org
				if (flags.select) {
					const { imsOrgCode, projectId, workspaceId, workspaceName } = await initSdk({});

					try {
						meshId = await getMeshId(imsOrgCode, projectId, workspaceId, workspaceName);
					} catch (err) {
						throw new Error(
							`Unable to get mesh ID. Please check the details and try again. RequestId: ${global.requestId}`,
						);
					}

					try {
						await getMeshArtifact(imsOrgCode, projectId, workspaceId, workspaceName, meshId);
					} catch (err) {
						throw new Error(
							`Unable to retrieve mesh. Please check the details and try again. RequestId: ${global.requestId}`,
						);
					}

					try {
						await setUpTenantFiles(meshId);
					} catch (err) {
						throw new Error('Failed to install downloaded mesh');
					}

					this.log('Successfully downloaded mesh');
				} else {
					if (!args.file) {
						throw new Error('Missing file path. Run aio api-mesh run --help for more info.');
					}

					const envFilePath = await flags.env;

					//Read the mesh input file
					let inputMeshData = await readFileContents(args.file, this, 'mesh');
					let data;

					if (checkPlaceholders(inputMeshData)) {
						this.log(
							'The provided mesh contains placeholders. Starting mesh interpolation process.',
						);
						data = await validateAndInterpolateMesh(inputMeshData, envFilePath, this);
					} else {
						try {
							data = JSON.parse(inputMeshData);
						} catch (err) {
							this.log(err.message);
							throw new Error(
								'Input mesh file is not a valid JSON. Please check the file provided.',
							);
						}
					}

					let filesList = [];

					try {
						filesList = getFilesInMeshConfig(data, args.file);
					} catch (err) {
						this.log(err.message);
						throw new Error('Input mesh config is not valid.');
					}

					// if local files are present, import them in files array in meshConfig
					if (filesList.length) {
						try {
							// minification of js will not be done for run command if debugging is enabled
							data = await importFiles(
								data,
								filesList,
								args.file,
								flags.autoConfirmAction,
								!flags.debug,
							);
						} catch (err) {
							this.log(err.message);
							throw new Error(
								'Unable to import the files in the mesh config. Please check the file and try again.',
							);
						}
					}

					//Generating unique mesh id
					meshId = 'testMesh';

					await validateMesh(data.meshConfig);
					await buildMesh(meshId, data.meshConfig);
					await compileMesh(meshId);
				}
				let portNo;
				//secrets management
				if (secretsFilePath) {
					try {
						await validateSecretsFile(secretsFilePath);
						const stringifiedSecrets = await interpolateSecrets(secretsFilePath, this);
						await writeSecretsFile(stringifiedSecrets, meshId);
					} catch (error) {
						this.log(error.message);
						this.error('Unable to import secrets. Please check the file and try again.');
					}
				}

				await this.copyMeshContent(meshId);

				//To set the port number using the environment file
				if (process.env.PORT !== undefined) {
					if (isNaN(process.env.PORT) || !Number.isInteger(parseInt(process.env.PORT))) {
						throw new Error('PORT value in the .env file is not a valid integer');
					}

					portNo = process.env.PORT;
				}

				//To set the port number as the provided value in the command
				if (flags.port !== undefined) {
					portNo = flags.port;
				}

				//To set the default port to 5000
				if (!portNo) {
					portNo = 5000;
				}
				this.log(`Starting server on port : ${portNo}`);
				await runServer(portNo);
				this.log(`Server is running on http://localhost:${portNo}/graphql`);
			} else {
				throw new Error(
					'`aio api-mesh run` cannot be executed because there is no package.json file in the current directory. Use `aio api-mesh init` to set up a package.',
				);
			}
		} catch (error) {
			this.error(error.message);
		}
	}

	async copyMeshContent(meshId) {
		// Remove mesh artifact directory if exists
		if (fs.existsSync('.mesh')) {
			fs.rmSync('.mesh', { recursive: true });
		}
		// Move built mesh artifact to expect directory
		fs.renameSync(`mesh-artifact/${meshId}`, '.mesh');
		// Remove tenant files directory if exists
		if (fs.existsSync('tenantFiles')) {
			fs.rmSync('tenantFiles', { recursive: true });
		}
		// Move built tenant files if exists
		if (fs.existsSync('mesh-artifact/tenantFiles')) {
			fs.cpSync('mesh-artifact/tenantFiles', '.mesh/tenantFiles', { recursive: true });
			fs.renameSync('mesh-artifact/tenantFiles', 'tenantFiles');
		}

		await fixPlugins('.mesh/index.js');

		if (fs.existsSync(`${__dirname}/../../../.mesh`)) {
			fs.rmSync(`${__dirname}/../../../.mesh`, { recursive: true });
		}
		fs.cpSync('.mesh', `${__dirname}/../../../.mesh`, { recursive: true });
	}
}

module.exports = RunCommand;
