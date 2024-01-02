import fs from "fs";
import { v4 as uuidv4 } from "uuid";

import os from "os";
import path from "path";
const DESKTOP_DIR = path.join(os.homedir(), "Desktop");

class StoryModel {
  _uuid = uuidv4();
  _filename = null;

  _prompt = null;
  _storyPoints = [];

  _savePath = DESKTOP_DIR;

  set prompt(prompt) {
    this._prompt = prompt;
  }

  get prompt() {
    return this._prompt;
  }

  appendPrompt(prompt) {
    this._prompt += " " + prompt;
  }

  getFileName() {
    if (this._filename) {
      return this._filename;
    }

    let fileName = this._prompt.replace(/ /g, "_");
    let date = new Date();
    fileName = `${
      date.getMonth() + 1
    }-${date.getDate()}-${date.getFullYear()}_${fileName}_${this._uuid}`;
    this._filename = fileName;
    return fileName;
  }

  set storyPoints(storyPoints) {
    this._storyPoints = storyPoints;
  }

  get storyPoints() {
    return this._storyPoints;
  }

  addStoryPoint(storyPoint) {
    this._storyPoints.push(storyPoint);
  }

  getStoryPoint(index) {
    return this._storyPoints[index];
  }

  addStoryPointAt(storyPoint, index) {
    this._storyPoints.splice(index, 0, storyPoint);
  }

  getStory() {
    let story = this._prompt + "\n\n";
    for (let i = 0; i < this._storyPoints.length; i++) {
      story += `${this._storyPoints[i]}\n`;
    }
    return story;
  }

  setSavePath(savePath) {
    this._savePath = savePath;
  }

  async loadStoryFromFile(filepath) {
    return new Promise((resolve, reject) => {
      fs.readFile(filepath, "utf8", (err, data) => {
        if (err) {
          console.error(err);
          return;
        }

        const prompt = data.split("\n\n")[0];
        const storyPoints = data.split("\n\n")[1].split("\n");

        for (let i = 0; i < storyPoints.length; i++) {
          if (storyPoints[i] === "") {
            storyPoints.splice(i, 1);
          }
        }

        this.prompt = prompt;
        this.storyPoints = storyPoints;

        this._filename = filepath.split("/").pop().split(".")[0];

        resolve();
      });
    });
  }

  async writeStoryToFile(filename) {
    const filePath = path.join(this._savePath, filename);
    fs.writeFile(filePath, this.getStory(), function (err) {
      if (err) {
        return;
      }
    });
  }
}

export default new StoryModel();
