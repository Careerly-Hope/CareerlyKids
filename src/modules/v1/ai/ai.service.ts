// src/modules/ai/ai.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

export interface StreamRecommendationInput {
  careerCode: string;
  scores: {
    R: number;
    I: number;
    A: number;
    S: number;
    E: number;
    C: number;
  };
  topMatches: Array<{
    careerName: string;
    tags: string[];
  }>;
  tier: string;
}

export interface StreamRecommendationResult {
  recommendedStream: 'Art' | 'Science' | 'Commercial';
  reasoning: string;
  streamAlignment: {
    art: number;
    science: number;
    commercial: number;
  };
}

interface AIResponseData {
  recommendedStream: 'Art' | 'Science' | 'Commercial';
  reasoning: string;
  streamAlignment: {
    art: number;
    science: number;
    commercial: number;
  };
}

function isValidAIResponse(data: unknown): data is AIResponseData {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as AIResponseData).recommendedStream === 'string' &&
    ['Art', 'Science', 'Commercial'].includes((data as AIResponseData).recommendedStream) &&
    typeof (data as AIResponseData).reasoning === 'string' &&
    typeof (data as AIResponseData).streamAlignment === 'object' &&
    (data as AIResponseData).streamAlignment !== null &&
    typeof (data as AIResponseData).streamAlignment.art === 'number' &&
    typeof (data as AIResponseData).streamAlignment.science === 'number' &&
    typeof (data as AIResponseData).streamAlignment.commercial === 'number'
  );
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private configService: ConfigService) {}

  async generateStreamRecommendation(
    input: StreamRecommendationInput,
  ): Promise<StreamRecommendationResult> {
    try {
      const prompt = this.buildStreamRecommendationPrompt(input);

      const apiKey = this.configService.get<string>('GROQ_API_KEY');
      if (!apiKey) {
        throw new Error('GROQ_API_KEY not configured');
      }

      const groqProvider = createGroq({ apiKey });
      const model = groqProvider('llama-3.3-70b-versatile');

      const { text } = await generateText({
        model,
        prompt,
        temperature: 0.7,
      });

      return this.parseStreamRecommendationResponse(text);
    } catch (error) {
      this.logger.error('Failed to generate stream recommendation:', error);
      throw new BadRequestException('Failed to generate stream recommendation');
    }
  }

  private buildStreamRecommendationPrompt(input: StreamRecommendationInput): string {
    const topCareers = input.topMatches
      .slice(0, 3)
      .map((c) => `${c.careerName} (${c.tags.join(', ')})`)
      .join(', ');

    return `
You are an expert educational counselor specializing in Nigerian secondary education streams. Based on a student's RIASEC career assessment results, recommend the BEST academic stream.

Assessment Results:
- RIASEC Code: ${input.careerCode}
- Interest Scores:
  * Realistic (R): ${input.scores.R}/50 - Hands-on, mechanical, technical work
  * Investigative (I): ${input.scores.I}/50 - Research, analysis, problem-solving
  * Artistic (A): ${input.scores.A}/50 - Creative, expressive, artistic work
  * Social (S): ${input.scores.S}/50 - Helping people, teaching, counseling
  * Enterprising (E): ${input.scores.E}/50 - Leading, persuading, business
  * Conventional (C): ${input.scores.C}/50 - Organizing, data, detail-oriented
- Achievement Tier: ${input.tier}
- Top Career Matches: ${topCareers}

Nigerian Academic Streams:
1. **Science** - Physics, Chemistry, Biology, Mathematics (leads to Medicine, Engineering, Pure Sciences)
2. **Art** - Literature, Government, History, CRS/IRS (leads to Law, Social Sciences, Humanities)
3. **Commercial** - Accounting, Commerce, Economics (leads to Business, Accounting, Finance)

Analysis Guidelines:
- High I + R scores → Science stream (investigation + technical skills)
- High A + S scores → Art stream (creativity + social awareness)
- High E + C scores → Commercial stream (business + organization)
- Consider the top career matches and their typical educational paths
- The recommendation must align with Nigerian secondary school curriculum

Provide your response in this EXACT JSON format (no markdown, no extra text):
{
  "recommendedStream": "Science" OR "Art" OR "Commercial",
  "reasoning": "2-3 sentences explaining why this stream best fits their RIASEC profile and career goals",
  "streamAlignment": {
    "art": 65,
    "science": 85,
    "commercial": 45
  }
}

Notes:
- recommendedStream must be EXACTLY one of: "Science", "Art", "Commercial"
- streamAlignment scores should total approximately 195-200 and reflect the strength of fit (0-100 each)
- reasoning should be specific to their scores and career matches

Response (JSON only):`;
  }

  private parseStreamRecommendationResponse(response: string): StreamRecommendationResult {
    try {
      let cleanedResponse = response.trim();
      cleanedResponse = cleanedResponse.replace(/```json\n?/, '').replace(/```$/, '');

      const jsonMatch: RegExpMatchArray | null = cleanedResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.error('No JSON found in AI response:', cleanedResponse);
        throw new Error('No JSON found in response');
      }

      const parsed: unknown = JSON.parse(jsonMatch[0]);

      if (!isValidAIResponse(parsed)) {
        this.logger.error('Invalid AI response structure:', parsed);
        throw new Error('Invalid structure in AI response');
      }

      return {
        recommendedStream: parsed.recommendedStream,
        reasoning: parsed.reasoning,
        streamAlignment: parsed.streamAlignment,
      };
    } catch (error) {
      this.logger.error('Failed to parse AI response:', error);
      if (error instanceof SyntaxError) {
        throw new BadRequestException('Invalid JSON response from AI service');
      }
      throw new BadRequestException('Failed to process AI service response');
    }
  }
}
