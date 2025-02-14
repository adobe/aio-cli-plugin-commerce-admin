/*
Copyright 2020 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const { Command, Flags } = require('@oclif/core');
const SourceRegistryStorage = require('source-registry-storage-adapter');
const { promptConfirm, promptInput, initRequestId, initSdk } = require('../../../helpers');
const { ignoreCacheFlag } = require('../../../utils');
const config = require('@adobe/aio-lib-core-config');
const logger = require('../../../classes/logger');
const { readFile } = require('fs/promises');
const chalk = require('chalk');
const { getMeshId, getMesh, updateMesh } = require('../../../lib/devConsole');
const JsonInterpolate = require('json-interpolate');

class InstallCommand extends Command {
	static args = [{ name: 'source' }];

	constructor() {
		super(...arguments);
		this.sourceRegistryStorage = new SourceRegistryStorage(
			config.get('api-mesh.sourceRegistry.path'),
		);
	}

	async run() {
		const { flags, args } = await this.parse(InstallCommand);
		await initRequestId();
		logger.info(`RequestId: ${global.requestId}`);
		const ignoreCache = await flags.ignoreCache;
		const {
			imsOrgId,
			imsOrgCode,
			projectId,
			workspaceId,
			organizationName,
			projectName,
			workspaceName,
		} = await initSdk({ ignoreCache });
		const filepath = flags['variable-file'];
		let variables = flags.variable
			? flags.variable.reduce((obj, val) => {
					const splited = val.split('=');
					obj[splited[0].trim()] = splited[1].trim();
					return obj;
			  }, {})
			: {};

		if (filepath) {
			try {
				variables = { ...variables, ...JSON.parse(await readFile(filepath, 'utf8')) };
			} catch (e) {
				this.error(`Something went wrong trying to read the variables file.` + `\n${e.message}`);
			}
		}

		let meshId = null;
		if (!args.source && !flags.source) {
			this.error(
				`The "aio api-mesh:source:install" command requires additional parameters` +
					`\nUse "aio api-mesh:source:install --help" to see parameters details.`,
			);
		}
		let sourceProviders;
		try {
			sourceProviders = await this.sourceRegistryStorage.getList();
		} catch (err) {
			this.error(`Cannot get the list of sources: ${err}. RequestId: ${global.requestId}`);
		}
		const sources = flags.source ? flags.source : [args.source];
		const sourceConfigs = { sources: [], files: {} };
		for (const source of sources) {
			let [name, version] = source.split('@');
			const normalizedName = this.normalizeName(name);
			if (!sourceProviders[normalizedName]) {
				this.error(
					chalk.red(
						`The source named "${name}" doesn't exist.` +
							`\nUse "aio api-mesh:source:discover" command to see avaliable sources.`,
					),
				);
			}
			version = version || sourceProviders[normalizedName].latest;
			if (!sourceProviders[normalizedName].versions.includes(version)) {
				this.error(
					chalk.red(
						`The version "${version}" for source name "${name}" doesn't exist.` +
							`\nUse "aio api-mesh:source:discover" command to see avaliable source versions.`,
					),
				);
			}
			const sourceConfig = await this.sourceRegistryStorage.get(name, version);
			const jsonInterpolate = new JsonInterpolate({ variablesSchema: sourceConfig.variables });
			const sourceProviderString = JSON.stringify(sourceConfig.provider);
			const sourceVariables = jsonInterpolate.getJsonVariables(sourceProviderString);
			const passedSourceVariables = this.getPassedSourceVariables(sourceVariables || [], variables);
			const missedVariables = jsonInterpolate.getMissedVariables(
				passedSourceVariables,
				sourceVariables,
			);
			for (const missedVariable of missedVariables
				.map(item => item.name)
				.filter((value, index, self) => self.indexOf(value) === index)) {
				passedSourceVariables[missedVariable] = await promptInput(
					`Enter the value for variable ${missedVariable}:`,
				);
			}

			const { error, data } = jsonInterpolate.interpolate(
				JSON.stringify(sourceConfig.provider),
				passedSourceVariables,
			);
			if (error) {
				this.error(chalk.red(`${error.message}\n${error.list.map(err => err.message).join('\n')}`));
			}

			sourceConfigs.sources.push(JSON.parse(data));
			sourceConfigs.files[sourceConfig.provider.name] = sourceConfig.files;
		}

		try {
			meshId = await getMeshId(imsOrgCode, projectId, workspaceId, workspaceName);
		} catch (err) {
			this.error(
				`Unable to get mesh ID. Please check the details and try again. RequestId: ${global.requestId}`,
			);
		}

		if (!meshId) {
			this.error(
				`Unable to get mesh config. No mesh found for Org(${imsOrgId}) -> Project(${projectId}) -> Workspace(${workspaceId}). Please check the details and try again.`,
			);
		}

		try {
			const mesh = await getMesh(imsOrgCode, projectId, workspaceId, meshId, workspaceName);

			if (!mesh) {
				this.error(
					`Unable to get mesh with the ID ${meshId}. Please check the mesh ID and try again. RequestId: ${global.requestId}`,
					{ exit: false },
				);
			}
			const verifiedSources = this.verifySourceAlreadyExists(
				mesh.meshConfig.sources,
				sourceConfigs.sources,
			);

			let override = false;
			if (verifiedSources.installed.length) {
				override = flags.confirm
					? true
					: await promptConfirm(
							`The following sources are already installed: ${verifiedSources.installed
								.map(source => source.name)
								.join(', ')}.
                    Do you want to override?`,
					  );
			}

			const uniqueFiles = this.getSourceFiles(
				verifiedSources.unique.map(source => source.name),
				sourceConfigs.files,
			);
			const installedFiles = this.getSourceFiles(
				verifiedSources.installed.map(source => source.name),
				sourceConfigs.files,
			);
			let meshConfigFiles = mesh.meshConfig.files || [];

			if (override) {
				const installedMap = verifiedSources.installed.reduce((obj, source) => {
					obj[source.name] = true;
					return obj;
				}, {});

				mesh.meshConfig.sources = [
					...mesh.meshConfig.sources.filter(source => !installedMap[source.name]),
					...verifiedSources.installed,
				];

				const installedFilesMap = installedFiles.reduce((obj, file) => {
					obj[file.path] = true;
					return obj;
				}, {});

				meshConfigFiles = [
					...meshConfigFiles.filter(file => !installedFilesMap[file.path]),
					...installedFiles,
				];
			}

			mesh.meshConfig.sources = [...mesh.meshConfig.sources, ...verifiedSources.unique];

			meshConfigFiles = [...meshConfigFiles, ...uniqueFiles];

			if (meshConfigFiles.length) {
				mesh.meshConfig.files = meshConfigFiles;
			}

			try {
				const response = await updateMesh(
					imsOrgId,
					projectId,
					workspaceId,
					workspaceName,
					organizationName,
					projectName,
					meshId,
					{
						meshConfig: mesh.meshConfig,
					},
				);

				this.log('Successfully updated the mesh with the id: %s', meshId);

				return response;
			} catch (error) {
				this.log(error.message);

				this.error(
					`Unable to update the mesh. Please check the mesh configuration file and try again. If the error persists please contact support. RequestId: ${global.requestId}`,
				);
			}

			return mesh;
		} catch (error) {
			this.log(error.message);
			this.error(
				`Unable to get mesh. Please check the details and try again. If the error persists please contact support. RequestId: ${global.requestId}`,
			);
		}
	}

	normalizeName(name) {
		return name.toLowerCase().split(' ').join('-');
	}

	getSourceFiles(sourcesList, filesList) {
		let result = [];
		for (const source of sourcesList) {
			if (Array.isArray(filesList[source])) {
				result = [...result, ...filesList[source]];
			}
		}
		return result;
	}

	getPassedSourceVariables(variablesInSource, passedVariables) {
		const res = {};
		variablesInSource.forEach(variable => {
			if (passedVariables[variable.name]) {
				res[variable.name] = passedVariables[variable.name];
			}
		});
		return res;
	}

	verifySourceAlreadyExists(meshSources, installSources) {
		const alreadyInstalledSources = [];
		const uniqueSourcesToInstall = [];
		installSources.forEach(installSource => {
			const source = meshSources.find(meshSource => meshSource.name === installSource.name);
			if (source) {
				alreadyInstalledSources.push(source);
			} else {
				uniqueSourcesToInstall.push(installSource);
			}
		});
		return {
			installed: alreadyInstalledSources,
			unique: uniqueSourcesToInstall,
		};
	}
}

InstallCommand.flags = {
	'source': Flags.string({
		char: 's',
		description: 'Source name',
		multiple: true,
	}),
	'confirm': Flags.boolean({
		char: 'c',
		description:
			'Auto confirm override action prompt. CLI will not check ask user to override source.',
		default: false,
	}),
	'variable': Flags.string({
		char: 'v',
		description: 'Variables required for the source',
		multiple: true,
	}),
	'variable-file': Flags.string({
		char: 'f',
		description: 'Variables file path',
	}),
	'ignoreCache': ignoreCacheFlag,
};

InstallCommand.description = 'Command to install the source to your API mesh.';
InstallCommand.examples = [
	'$ aio api-mesh:source:install <version>@<source_name>',
	'$ aio api-mesh:source:install <source_name> -v <variable_name>=<variable_value>',
	'$ aio api-mesh:source:install <source_name> -f <path_to_variables_file>',
];

module.exports = InstallCommand;
