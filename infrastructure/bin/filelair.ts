#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { FileLairStack } from "../lib/filelair-stack";

const app = new cdk.App();

const githubOrg = "hanabiscus";
const githubRepo = "file-sharing";

new FileLairStack(app, "FileLairStack", {
  githubOrg,
  githubRepo,
});
