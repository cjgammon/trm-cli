#! /usr/bin/env node

import chalk from "chalk";
import boxen from "boxen";

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import OpenAI from "openai";

import storyModel from "./storyModel.js";

import { STORY_CIRCLE, MAX_STEPS } from "./consts.js";
import { input } from "@inquirer/prompts";
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

const SYSTEM_PROMPT = `You are a story outline generator, generate basic story outlines based on a prompt. The outline should be in the format of a story circle. \n The entire story circle is as follows: ${STORY_CIRCLE.map(
  (step) => {
    return `${step.name}:${step.description}`;
  }
).join(", ")}`;

const usage = `\nUsage: storybot "<prompt>" [options]`;

console.log(
  chalk.green(
    boxen("Storybot", {
      padding: 0.5,
      borderStyle: "classic",
      textAlignment: "center",
    })
  )
);

yargs
  .usage(usage)
  .option("l", {
    alias: "load",
    describe: "load story from file",
    type: "string",
    demandOption: false,
  })
  .option("t", {
    alias: "temperature",
    describe: "creativity of output [0-2] (default: 1)",
    type: "number",
    demandOption: false,
  })
  .option("o", {
    alias: "output",
    describe: "output directory",
    type: "string",
    demandOption: false,
  })

  .help(true).argv;

const TEMP = yargs.argv.t || 1;
const FILE_TO_LOAD = yargs.argv.l || null;
const OUTPUT_DIR = yargs.argv.o || null;

console.log(chalk.red(`TEMP: ${TEMP}`));

let storyIndex = 0;

runStorybot();

function handlePromptError(error) {
  if (error.isTtyError) {
    //console.error("The prompt was closed by the user.");
    // Optionally, you can ask the user if they want to restart the prompt.
  } else {
    //console.error("An error occurred:", error);
    // Handle other errors as needed.
  }
}

async function storyPoint(options) {
  options.push({ value: options.length, name: "explore more" });
  try {
    const answer = await rawlist({
      message: `select an option for: ${STORY_CIRCLE[storyIndex].name}`,
      choices: options,
    });

    if (answer === options.length - 1) {
      /*
      console.log(`Current Prompt: ${storyModel.prompt}`);
      prompt = await input({ message: "please elaborate" });
      storyModel.appendPrompt(prompt);
      */
      requestOptions(storyModel.prompt, storyIndex);
    } else {
      storyModel.addStoryPointAt(answer, storyIndex);

      storyModel.writeStoryToFile(`${storyModel.getFileName()}.txt`);

      if (storyIndex === MAX_STEPS - 1) {
        console.log("story complete");
        return;
      }

      storyIndex++;
      requestOptions(storyModel.prompt, storyIndex);
    }
  } catch (e) {
    handlePromptError(e);
  }
}

async function runStorybot() {
  if (FILE_TO_LOAD) {
    await storyModel.loadStoryFromFile(FILE_TO_LOAD);
    storyIndex = storyModel.storyPoints.length;
    requestOptions(storyModel.prompt, storyIndex);
    return;
  }

  if (OUTPUT_DIR) {
    storyModel.setSavePath(OUTPUT_DIR);
  }

  let prompt = yargs.argv._[0];

  if (prompt == null) {
    try {
      prompt = await input({ message: "describe your story" });
    } catch (e) {
      handlePromptError(e);
    }
  }

  console.log(chalk.hex("#ff00ff")(prompt));
  storyModel.prompt = prompt;

  requestOptions(storyModel.prompt, storyIndex);
  //then prompt with clarifying questions.
}

async function requestOptions(prompt, index = 0) {
  let USER_PROMPT = `Create 3 options to pass to storyPoint function: using ${prompt} as the story prompt, and ${STORY_CIRCLE[index].name}:${STORY_CIRCLE[index].description} as the part of the story circle we are giving options for.`;

  if (storyModel.storyPoints.length > 0) {
    USER_PROMPT += ` \n\n The story so far: ${storyModel.getStory()}`;
  }

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
        name: "story_point",
        description: "generate story point options",
        parameters: {
          type: "object",
          properties: {
            options: {
              type: "array",
              description: "list of story point options",
              items: {
                type: "object",
                description: "story point option object",
                properties: {
                  value: {
                    type: "string",
                    description: "story point option text",
                  },
                },
              },
            },
          },
          required: ["options"],
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
        story_point: storyPoint,
      }; // only one function in this example, but you can have multiple
      const functionName = responseMessage.function_call.name;
      const functionToCall = availableFunctions[functionName];
      const functionArgs = JSON.parse(responseMessage.function_call.arguments);
      const functionResponse = functionToCall(functionArgs.options);
    } catch (e) {
      console.log(e + ": " + JSON.stringify(responseMessage.function_call));
      //try again??
    }
  }
}
