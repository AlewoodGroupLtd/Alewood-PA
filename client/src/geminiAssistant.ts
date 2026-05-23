import { GoogleGenAI, Type } from '@google/genai';

export class GeminiAssistant {
  private ai: GoogleGenAI;
  private chatSession: any;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
    this.initChat();
  }

  private initChat() {
    this.chatSession = this.ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: `You are the Alewood AI Assistant. Your job is to help the CEO manage tasks and schedule meetings. 
If the user asks to create a meeting or schedule an event, use the create_meeting tool.
If the user asks to create a task, todo, or reminder, use the create_task tool. You can ask for missing information if needed, but it is acceptable to create a task with missing details if the user wants it done quickly.
The current date and time is ${new Date().toLocaleString('en-GB')}. Use this to resolve relative dates like "tomorrow".`,
        tools: [{
          functionDeclarations: [
            {
              name: 'create_meeting',
              description: 'Creates a calendar event in the user\'s primary Google Calendar.',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  title: { 
                    type: Type.STRING, 
                    description: 'Title or summary of the meeting.' 
                  },
                  startDateTime: { 
                    type: Type.STRING, 
                    description: 'Start time of the meeting in RFC3339 format (e.g. 2026-05-24T14:00:00Z).' 
                  },
                  endDateTime: { 
                    type: Type.STRING, 
                    description: 'End time of the meeting in RFC3339 format (e.g. 2026-05-24T15:00:00Z).' 
                  },
                  description: { 
                    type: Type.STRING, 
                    description: 'Optional description or agenda for the meeting.' 
                  }
                },
                required: ['title', 'startDateTime', 'endDateTime']
              }
            },
            {
              name: 'create_task',
              description: 'Creates a new task in the user\'s system. Tasks can either be CRM tasks (related to clients, sales, external companies) or Project tasks (internal product build, operations, HR).',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  context: {
                    type: Type.STRING,
                    description: 'The context of the task. Must be either "CRM" or "Project". Try to infer this based on what the user says.'
                  },
                  taskName: {
                    type: Type.STRING,
                    description: 'A concise description of the task.'
                  },
                  dueDate: {
                    type: Type.STRING,
                    description: 'The due date for the task. Use DD/MM/YYYY format. If not mentioned, use "TBD".'
                  },
                  category: {
                    type: Type.STRING,
                    description: 'For Project tasks only. Valid categories are: Product Build, Project Management, HR, Finance, Legal, Operations. Defaults to Operations if unsure.'
                  },
                  person: {
                    type: Type.STRING,
                    description: 'For CRM tasks only. The person this task relates to, if mentioned.'
                  },
                  company: {
                    type: Type.STRING,
                    description: 'For CRM tasks only. The company this task relates to, if mentioned.'
                  }
                },
                required: ['context', 'taskName']
              }
            }
          ]
        }]
      }
    });
  }

  async sendMessage(messageText: string) {
    const response = await this.chatSession.sendMessage({ message: messageText });
    return response;
  }

  async sendToolResponse(functionResponses: any[]) {
    const response = await this.chatSession.sendMessage(functionResponses);
    return response;
  }
}
