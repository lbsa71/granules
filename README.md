GRANULES is a minimal orchestrator for work.

When the central orchestrator is launched, it starts up an MCP (Model Context Protocol) http server, using  

import { MCPTool } from "mcp-framework";
import { z } from "zod";

(See https://mcp-framework.com/docs/http-quickstart/ for reference)

The MCP server keeps track of work, called 'granules', in an in-memory lookup, and exposes tools for CRUD manipulation of these.

Having launched the mcp server, the orchestrator then queries the MCP server for granules. If there are no granules, a template bootstrap granule with the content "Read README and plan implementation" is added, and the granules are re-read.

Granules have 'granule id' which is just an autoincremented identifier like "G-1"

For each 'unclaimed' granule, the orchestrator starts a claude code cli process, with a prompt containing a process id, if the form of "W-1" where the number increments with every process launch, the granule and some temeplate instructions.

The claude code cli JSON output should be logged to a per-worker file for monitoring. 

There should be an MCP tool for 'claiming' a granule, to lessen overlap. This on the form "claim: process id, granule id" 

A worker can also 'release' a granule to unclaim it, as well as submit and delete granules.

It is important to timestamp granule claims to identify crashed processes or deadlocks.

Granules can be of certain classes: 
Update Artifact
Critique Architecture
Consolidate Work (Merge the work of two workers)

They can be in these states:
Unclaimed
Claimed
Working
Awaiting Consolidation


