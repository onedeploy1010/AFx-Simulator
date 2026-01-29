import { type User, type InsertUser, type AFxConfig, defaultConfig } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getConfig(): Promise<AFxConfig>;
  saveConfig(config: AFxConfig): Promise<AFxConfig>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private config: AFxConfig;

  constructor() {
    this.users = new Map();
    this.config = defaultConfig;
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getConfig(): Promise<AFxConfig> {
    return this.config;
  }

  async saveConfig(config: AFxConfig): Promise<AFxConfig> {
    this.config = config;
    return this.config;
  }
}

export const storage = new MemStorage();
