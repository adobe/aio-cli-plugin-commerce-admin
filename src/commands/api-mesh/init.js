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

const { Command, Flags } = require('@oclif/core');
const resolve = require('path').resolve;

const { promptConfirm, loadPupa, runCliCommand } = require('../../helpers');
const { getAppRootDir } = require('../../utils');

const fs = require('fs');
const { exec } = require('child_process');
const { stdout, stderr } = require('process');

class InitCommand extends Command {
	static summary = 'Initiate API Mesh workspace';
	static description =
		'This command will create a workspace where you can organise your API mesh configuration and other files';

	static args = [
		{
			name: 'projectName',
			required: true,
			description: 'Project name'
		},
	];

	static flags = {
		path: Flags.string({
			char: 'p',
			summary: 'workspace path',
			default: '.'
		}),
		packageManager: Flags.string({
			char: 'm',
			summary: 'select yarn or npm for package management',
			helpGroup: 'THE BEST FLAGS',
			default: 'npm',
			options: ['npm', 'yarn'],
		}),
		git: Flags.boolean({
			default: false,
			char: 'g',
			summary: 'Should the workspace be initiated as a git project.',
			helpGroup: 'THE BEST FLAGS',
		}),
	};

	static enableJsonFlag = true;

	static examples = [
		{
			description: 'API mesh workspace init',
			command: 'aio api-mesh init ./mesh_projects/test_mesh --git --packageManager yarn',
		},
	];

    async createPackageJson(templatePath, filePath, projectTitle = 'api-mesh-starter') {
        const template = fs.readFileSync(templatePath, 'utf8');
        const pupa = await loadPupa();
        const fileContents = pupa(template, {projectTitle});
        fs.writeFileSync(filePath, fileContents);
    }

	async run() {
		const { args, flags } = await this.parse(InitCommand);
		const absolutePath = resolve(flags.path);
		const packageJsonTemplate = `${getAppRootDir()}/src/templates/package.json`;
		const shouldCreateWorkspace = await promptConfirm(
			`Do you want to create the workspace in ${absolutePath}`,
		);

		if (shouldCreateWorkspace) {
			this.log(`Creating workspace in ${absolutePath}`);

			if (flags.git) {
				this.log('Initiating git in workspace');
				try {
					await runCliCommand(`git init ${absolutePath}`);
				} catch (error) {
					this.error(error);
				}
			} else {
				fs.access(absolutePath, error => {
					if (error) {
						fs.mkdirSync(absolutePath, error => {
							if (error) {
								this.error(
									'Workspace couldn`t be created at the directory, please verify your permissions',
								);
							}
						});
					} else {
						this.error('Directory already exists. Delete the directory or change the directory');
					}
				});
			}

			this.log(`Installing package managers`);
			fs.closeSync(fs.openSync(absolutePath + '/.env', 'w'));
			await this.createPackageJson(packageJsonTemplate , absolutePath + '/package.json', args.projectName);

			if (flags.packageManager === 'npm') {
				try {
					await this.runCliCommand(`npm install`, absolutePath);
				} catch (error) {
					this.error(error);
				}
			}

			if (flags.packageManager === 'yarn') {
				try {
					await this.runCliCommand(`yarn install`, absolutePath);
				} catch (error) {
					this.error(error);
				}
			}

			this.log('workspace setup done successfully');
		}
	}
}

module.exports = InitCommand;
