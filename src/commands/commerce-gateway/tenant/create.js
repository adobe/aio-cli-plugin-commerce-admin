/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const { Command } = require('@oclif/command')
const { readFile } = require('fs/promises')

const { SchemaServiceClient } = require('../../../classes/SchemaServiceClient')

class CreateCommand extends Command {
  static args = [
    {name: 'file'}
  ]
  async run() {
    const { args } = this.parse(CreateCommand)
    const schemaServiceClient = new SchemaServiceClient()
    let data
    try {
      data = JSON.parse(await readFile(args.file, "utf8"))
      const tenant = await schemaServiceClient.createTenant(data)
      tenant ? this.log(`Successfully created a tenant with the id: ${data.tenantId}`) :
      this.error(`Unable to create a tenant with the id ${data.tenantId}`) 
      return tenant
    } catch (error) {
        this.error(`Unable to create a tenant with the given configuration`)
    } 
  }
}

CreateCommand.description = `Create a tenant with the given config.`

module.exports = CreateCommand
