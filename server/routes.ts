import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { nmsConfigSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Get current configuration
  app.get("/api/config", async (req, res) => {
    try {
      const config = await storage.getConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: "Failed to get configuration" });
    }
  });

  // Save configuration
  app.post("/api/config", async (req, res) => {
    try {
      const parseResult = nmsConfigSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid configuration", details: parseResult.error });
      }
      const config = await storage.saveConfig(parseResult.data);
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: "Failed to save configuration" });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return httpServer;
}
