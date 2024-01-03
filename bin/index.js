#! /usr/bin/env node
import { exec } from "child_process";

import chalk from "chalk";
import boxen from "boxen";

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import OpenAI from "openai";

import { input, confirm } from "@inquirer/prompts";
import rawlist from "@inquirer/rawlist";

import _yargs from "yargs";
import { hideBin } from "yargs/helpers";
const yargs = _yargs(hideBin(process.argv));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: `${__dirname}/.env`,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OS_NAME = process.platform;

const SYSTEM_PROMPT = `\n 
You are a command line assistant for ${OS_NAME} platform.\n 
You take user input and translate it into a command that can be run in the terminal.\n
The resulting command should be able to run in the terminal.\n 
the output of the command should return the kind of results the user asks for.\n
If the user puts text in quotes, or any other values are specified use these as variables or params that are included in the command.\n

For example if the users asks:

"find the text 'run' in this directory"\n

The command should be:\n

grep -r "run" .\n

Replace the text in quotes with the text the user wants to find, and the path to the file they want to search.\n
Only provide the command, no description text or any extra information.\n
Do not add any placeholder text or properties.\n
If no directory or context is provided assume it is global.\n
\n`;

const usage = `\nUsage: trm "<prompt>" [options]`;

yargs
  .usage(usage)
  .option("t", {
    alias: "temperature",
    describe: "creativity of output [0-2] (default: 1)",
    type: "number",
    demandOption: false,
  })

  .help(true).argv;

const TEMP = yargs.argv.t || 1;

let storyIndex = 0;

run();

function handlePromptError(error) {
  if (error.isTtyError) {
    //console.error("The prompt was closed by the user.");
    // Optionally, you can ask the user if they want to restart the prompt.
  } else {
    //console.error("An error occurred:", error);
    // Handle other errors as needed.
  }
}

async function runCommand(command) {
  try {
    const answer = await confirm({
      message: `run command: ${command}`,
    });

    if (answer) {
      exec(
        command,
        { maxBuffer: 1000 * 1000 * 10 },
        (error, stdout, stderr) => {
          if (error) {
            console.log(chalk.red(`error: ${error.message}, ${error.code}`));
            return;
          }
          if (stderr) {
            console.log(`stderr: ${stderr}`);
            return;
          }
          console.log(chalk.blue(stdout));
        }
      );
    }
  } catch (e) {
    handlePromptError(e);
  }
}

async function run() {
  //let prompt = yargs.argv._[0];
  const prompt = yargs.argv._.join(" ");

  if (prompt == null) {
    console.log(chalk.red("you must provide a prompt"));
    return;
  }

  //make request
  await requestOptions(prompt);
}

async function requestOptions(prompt, index = 0) {
  let USER_PROMPT = `${prompt}`;

  const chatCompletion = await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: USER_PROMPT,
      },
    ],
    functions: [
      {
        name: "run_command",
        description: "run a command in the terminal",
        parameters: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "string to run in the terminal",
            },
          },
          required: ["command"],
        },
      },
    ],
    function_call: "auto",
    model: "gpt-3.5-turbo",
    temperature: TEMP,
    top_p: 1,
  });

  const responseMessage = chatCompletion.choices[0].message;

  if (responseMessage.function_call) {
    try {
      const availableFunctions = {
        run_command: runCommand,
      };
      const functionName = responseMessage.function_call.name;
      const functionToCall = availableFunctions[functionName];
      const functionArgs = JSON.parse(responseMessage.function_call.arguments);
      const functionResponse = functionToCall(functionArgs.command);
    } catch (e) {
      console.log(
        "ERR" + e + ": " + JSON.stringify(responseMessage.function_call)
      );
      //try again??
    }
  } else {
    console.log("no function call");
  }
}
