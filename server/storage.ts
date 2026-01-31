import { type User, type InsertUser, type NMSConfig, defaultConfig } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getConfig(): Promise<NMSConfig>;
  saveConfig(config: NMSConfig): Promise<NMSConfig>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private config: NMSConfig;

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

  async getConfig(): Promise<NMSConfig> {
    return this.config;
  }

  async saveConfig(config: NMSConfig): Promise<NMSConfig> {
    this.config = config;
    return this.config;
  }
}

export const storage = new MemStorage();
