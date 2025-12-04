// src/common/services/email/email.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { TokenType } from '@prisma/client';

export interface SendAccessTokenParams {
  email: string;
  name?: string;
  school?: string;
  token: string;
  type: TokenType;
  expiresAt: Date;
  maxUsage: number;
}

export interface CareerMatch {
  careerName: string;
  description: string;
  matchScore: number;
  tags: string[];
  jobZone: number;
}

export interface SendResultsParams {
  parentEmail: string;
  studentName: string;
  studentClass: string;
  school?: string;
  careerCode: string;
  scores: Record<string, number>;
  totalScore: number;
  tier: string;
  matches: CareerMatch[];
  streamRecommendation: {
    recommendedStream: string;
    reasoning: string;
    streamAlignment: {
      science: number;
      commercial: number;
      art: number;
    };
  };
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly supportEmail: string;
  private readonly assessmentUrl: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not configured. Email sending disabled.');
    }
    this.resend = new Resend(apiKey);
    this.fromEmail = this.configService.get<string>('FROM_EMAIL');
    this.supportEmail = this.configService.get<string>('SUPPORT_EMAIL');
    this.assessmentUrl = this.configService.get<string>('ASSESSMENT_URL');
  }

  async sendAccessToken(params: SendAccessTokenParams): Promise<void> {
    const { email, type } = params;
    try {
      this.logger.log(`Sending ${type} access token to ${email}`);
      const subject = this.getEmailSubject(type, params.school);
      const html = this.generateTokenEmailHtml(params);
      const text = this.generateTokenEmailText(params);

      await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject,
        html,
        text,
      });

      this.logger.log(`Access token email sent successfully to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${email}:`, error);
      throw error;
    }
  }

  async sendResults(params: SendResultsParams): Promise<void> {
    const { parentEmail, studentName } = params;
    try {
      this.logger.log(`Sending assessment results to ${parentEmail} for student ${studentName}`);
      const subject = this.getResultsEmailSubject(studentName, params.school);
      const html = this.generateResultsEmailHtml(params);
      const text = this.generateResultsEmailText(params);

      await this.resend.emails.send({
        from: this.fromEmail,
        to: parentEmail,
        subject,
        html,
        text,
      });

      this.logger.log(`Results email sent successfully to ${parentEmail}`);
    } catch (error) {
      this.logger.error(`Failed to send results email to ${parentEmail}:`, error);
      throw error;
    }
  }

  private getEmailSubject(type: TokenType, school?: string): string {
    if (type === TokenType.ENTERPRISE && school) {
      return `Your ${school} Career Assessment Access`;
    }
    return 'Your Career Assessment Access Token';
  }

  private getResultsEmailSubject(studentName: string, school?: string): string {
    if (school) {
      return `${studentName}'s Career Assessment Results - ${school}`;
    }
    return `${studentName}'s Career Assessment Results`;
  }

  private generateTokenEmailHtml(params: SendAccessTokenParams): string {
    const { name, school, token, type, expiresAt, maxUsage } = params;
    const greeting = name ? `Hi ${name}` : 'Hello';
    const dynamicAssessmentUrl = `${this.assessmentUrl}/${token}`;
    const expiryDate = expiresAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const usageText =
      type === TokenType.INDIVIDUAL
        ? 'This token can be used <strong>once</strong>.'
        : `This token can be used <strong>${maxUsage} times</strong>.`;

    const institutionText = school
      ? `<p>This token has been issued by <strong>${school}</strong> for career assessment access.</p>`
      : '';

    return `
<!DOCTYPE html>
<html>
<body style="background-color: #f5f5f5; margin:0; padding:0;">
  <table width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" style="padding:40px 0;">
        <table width="600" style="background:#ffffff; border-radius:8px;">
          
          <!-- HEADER -->
          <tr>
            <td style="padding:40px; text-align:center; background:#667eea; color:#fff; border-radius:8px 8px 0 0;">
              <h1 style="margin:0; font-size:26px;">🎯 Careerly Kids – Assessment Access</h1>
            </td>
          </tr>
          <!-- BODY -->
          <tr>
            <td style="padding:40px; font-size:15px; color:#333;">
              <p>${greeting},</p>
              <p>Welcome to <strong>Careerly Kids</strong> — where we help young learners discover their strengths and future career paths.</p>
              ${institutionText}
              <p>Your access token is ready!</p>
              <div style="border:2px dashed #667eea; padding:20px; text-align:center; margin:20px 0;">
                <p style="margin:0 0 10px; color:#667eea; font-weight:600;">Your Access Token</p>
                <code style="display:block; padding:15px; background:#fff; border:1px solid #eee; border-radius:6px; font-size:18px;">
                  ${token}
                </code>
              </div>
              <p><strong>Usage Limit:</strong> ${maxUsage}</p>
              <p><strong>Expires:</strong> ${expiryDate}</p>
              <div style="background:#fff3cd; padding:15px; margin:20px 0; border-left:4px solid #ffc107;">
                <p><strong>Important:</strong> Keep this token secure. ${usageText}</p>
              </div>
              <div style="text-align:center; margin:30px 0;">
                <a href="${dynamicAssessmentUrl}"
                   style="background:#667eea; color:#fff; padding:12px 25px; text-decoration:none; border-radius:6px;">
                  Start Assessment
                </a>
              </div>
              <p style="text-align:center; color:#666;">
                Need help? Contact us at 
                <a href="mailto:${this.supportEmail}" style="color:#667eea;">
                  ${this.supportEmail}
                </a>
              </p>
            </td>
          </tr>
          <!-- FOOTER -->
          <tr>
            <td style="background:#f8f9fa; padding:20px; text-align:center; font-size:12px; color:#999;">
              © ${new Date().getFullYear()} Careerly Kids. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
  }

  private generateResultsEmailHtml(params: SendResultsParams): string {
    const { studentName, studentClass, school, careerCode, scores, totalScore, tier, matches, streamRecommendation } = params;

    const institutionText = school
      ? `<p style="color:#666; margin-bottom: 20px;">Assessment completed through <strong>${school}</strong></p>`
      : '';

    // Generate RIASEC scores bars
    const riasecLabels = {
      R: 'Realistic',
      I: 'Investigative', 
      A: 'Artistic',
      S: 'Social',
      E: 'Enterprising',
      C: 'Conventional'
    };

    const scoresBars = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .map(([key, value]) => {
        const percentage = (value / 60) * 100; // Assuming max score per category is 60
        const color = this.getScoreColor(percentage);
        return `
          <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 600; color: #333;">${riasecLabels[key]} (${key})</span>
              <span style="color: #666;">${value} points</span>
            </div>
            <div style="background: #e0e0e0; border-radius: 10px; height: 20px; overflow: hidden;">
              <div style="background: ${color}; width: ${percentage}%; height: 100%; border-radius: 10px; transition: width 0.3s ease;"></div>
            </div>
          </div>
        `;
      }).join('');

    // Generate stream alignment bars
    const streamBars = Object.entries(streamRecommendation.streamAlignment)
      .sort((a, b) => b[1] - a[1])
      .map(([stream, value]) => {
        const color = stream === streamRecommendation.recommendedStream.toLowerCase() ? '#4caf50' : '#667eea';
        const icon = stream === 'science' ? '🔬' : stream === 'commercial' ? '💼' : '🎨';
        return `
          <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 600; color: #333;">${icon} ${stream.charAt(0).toUpperCase() + stream.slice(1)}</span>
              <span style="color: #666;">${value}%</span>
            </div>
            <div style="background: #e0e0e0; border-radius: 10px; height: 18px; overflow: hidden;">
              <div style="background: ${color}; width: ${value}%; height: 100%; border-radius: 10px;"></div>
            </div>
          </div>
        `;
      }).join('');

    // Generate career cards
    const careerCards = matches.slice(0, 10).map((career, index) => {
      const tags = career.tags.slice(0, 4).map(tag => 
        `<span style="display: inline-block; background: #e3f2fd; color: #1976d2; padding: 4px 10px; border-radius: 12px; font-size: 12px; margin: 2px;">${tag}</span>`
      ).join('');

      return `
        <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
            <h4 style="margin: 0; color: #667eea; font-size: 18px;">${index + 1}. ${career.careerName}</h4>
            <span style="background: #4caf50; color: white; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; white-space: nowrap; margin-left: 10px;">
              ${career.matchScore}% Match
            </span>
          </div>
          <p style="color: #555; line-height: 1.6; margin: 12px 0; font-size: 14px;">
            ${career.description}
          </p>
          <div style="margin-top: 12px;">
            ${tags}
            <span style="display: inline-block; background: #fff3cd; color: #856404; padding: 4px 10px; border-radius: 12px; font-size: 12px; margin: 2px;">
              Job Zone ${career.jobZone}
            </span>
          </div>
        </div>
      `;
    }).join('');

    return `
<!DOCTYPE html>
<html>
<body style="background-color: #f5f5f5; margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="700" style="background:#ffffff; border-radius:12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 100%;">
          
          <!-- HEADER -->
          <tr>
            <td style="padding:40px; text-align:center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:#fff; border-radius:12px 12px 0 0;">
              <h1 style="margin:0; font-size:28px; font-weight: 700;">🎓 Career Assessment Results</h1>
              <p style="margin: 10px 0 0; font-size: 16px; opacity: 0.95;">Complete Career Analysis Report</p>
            </td>
          </tr>

          <!-- STUDENT INFO -->
          <tr>
            <td style="padding:30px 40px 20px;">
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea;">
                <h3 style="margin: 0 0 10px; color: #333;">Student Information</h3>
                <p style="margin: 5px 0; color: #555;"><strong>Name:</strong> ${studentName}</p>
                <p style="margin: 5px 0; color: #555;"><strong>Class:</strong> ${studentClass}</p>
                ${school ? `<p style="margin: 5px 0; color: #555;"><strong>School:</strong> ${school}</p>` : ''}
              </div>
            </td>
          </tr>

          <!-- OVERVIEW -->
          <tr>
            <td style="padding:20px 40px;">
              <h2 style="color: #667eea; margin: 0 0 20px; font-size: 24px; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
                📊 Assessment Overview
              </h2>
              
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
                <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; text-align: center;">
                  <div style="font-size: 14px; color: #2e7d32; margin-bottom: 5px;">Career Code</div>
                  <div style="font-size: 28px; font-weight: 700; color: #1b5e20;">${careerCode}</div>
                </div>
                <div style="background: #fff3e0; padding: 20px; border-radius: 8px; text-align: center;">
                  <div style="font-size: 14px; color: #e65100; margin-bottom: 5px;">Tier Level</div>
                  <div style="font-size: 28px; font-weight: 700; color: #bf360c;">${tier}</div>
                </div>
              </div>

              <div style="background: #f0f4ff; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
                <div style="font-size: 14px; color: #667eea; margin-bottom: 5px;">Total Assessment Score</div>
                <div style="font-size: 36px; font-weight: 700; color: #5568d3;">${totalScore} / 180</div>
              </div>
            </td>
          </tr>

          <!-- RIASEC SCORES -->
          <tr>
            <td style="padding:20px 40px;">
              <h2 style="color: #667eea; margin: 0 0 20px; font-size: 24px; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
                🎯 RIASEC Personality Profile
              </h2>
              <div style="background: #f8f9fa; padding: 25px; border-radius: 8px;">
                ${scoresBars}
              </div>
              <p style="color: #666; font-size: 13px; margin: 15px 0 0; font-style: italic;">
                * The RIASEC model identifies six personality types that align with different career paths: Realistic (hands-on), Investigative (analytical), Artistic (creative), Social (helping), Enterprising (leadership), and Conventional (organized).
              </p>
            </td>
          </tr>

          <!-- STREAM RECOMMENDATION -->
          <tr>
            <td style="padding:20px 40px;">
              <h2 style="color: #667eea; margin: 0 0 20px; font-size: 24px; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
                🎓 Recommended Academic Stream
              </h2>
              
              <div style="background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); color: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
                <div style="font-size: 16px; opacity: 0.95; margin-bottom: 8px;">Best Fit Stream</div>
                <div style="font-size: 32px; font-weight: 700;">${streamRecommendation.recommendedStream}</div>
              </div>

              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px; color: #333;">📝 Why This Stream?</h4>
                <p style="color: #555; line-height: 1.7; margin: 0;">${streamRecommendation.reasoning}</p>
              </div>

              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
                <h4 style="margin: 0 0 15px; color: #333;">Stream Alignment Analysis</h4>
                ${streamBars}
              </div>
            </td>
          </tr>

          <!-- TOP CAREER MATCHES -->
          <tr>
            <td style="padding:20px 40px;">
              <h2 style="color: #667eea; margin: 0 0 20px; font-size: 24px; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
                💼 Top ${matches.length} Career Matches
              </h2>
              <p style="color: #666; margin-bottom: 25px; line-height: 1.6;">
                Based on ${studentName}'s personality profile and interests, here are the careers that offer the best alignment:
              </p>
              ${careerCards}
            </td>
          </tr>

          <!-- NEXT STEPS -->
          <tr>
            <td style="padding:20px 40px;">
              <div style="background: #e8f5e9; padding: 25px; border-radius: 8px; border-left: 4px solid #4caf50;">
                <h3 style="margin: 0 0 15px; color: #2e7d32;">💡 Next Steps for Parents</h3>
                <ul style="color: #555; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li><strong>Review Together:</strong> Discuss these results with your child and explore which careers interest them most.</li>
                  <li><strong>Research Careers:</strong> Learn more about the top career matches and their educational requirements.</li>
                  <li><strong>Academic Planning:</strong> Consider the recommended stream when making subject choices.</li>
                  <li><strong>Seek Guidance:</strong> Consult with school counselors to create a personalized career development plan.</li>
                  <li><strong>Explore Opportunities:</strong> Look for internships, workshops, or mentorship programs in areas of interest.</li>
                </ul>
              </div>
            </td>
          </tr>

          <!-- SUPPORT -->
          <tr>
            <td style="padding:30px 40px;">
              <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                <p style="color: #666; margin: 0 0 10px;">Questions about these results?</p>
                <p style="margin: 0;">
                  <a href="mailto:${this.supportEmail}" style="color: #667eea; text-decoration: none; font-weight: 600;">
                    📧 ${this.supportEmail}
                  </a>
                </p>
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f8f9fa; padding:30px 40px; text-align:center; font-size:13px; color:#999; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 10px;">© ${new Date().getFullYear()} Careerly Kids. All rights reserved.</p>
              <p style="margin: 0;">Empowering students to discover their future potential through personalized career guidance.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
  }

  private getScoreColor(percentage: number): string {
    if (percentage >= 75) return '#4caf50';
    if (percentage >= 50) return '#2196f3';
    if (percentage >= 25) return '#ff9800';
    return '#f44336';
  }

  private generateTokenEmailText(params: SendAccessTokenParams): string {
    const { name, school, token, type, expiresAt, maxUsage } = params;
    const greeting = name ? `Hi ${name}` : 'Hello';
    const expiryDate = expiresAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const institutionText = school ? `Issued by ${school}\n` : '';

    return `
${greeting},
${institutionText}
Your access token:
${token}

DETAILS:
- Type: ${type === TokenType.INDIVIDUAL ? 'Individual' : 'Enterprise'}
- Usage Limit: ${maxUsage}
- Expires: ${expiryDate}

Need help? Contact: ${this.supportEmail}
Start assessment: ${this.assessmentUrl}

© ${new Date().getFullYear()} Careerly Kids. All rights reserved.
`.trim();
  }

  private generateResultsEmailText(params: SendResultsParams): string {
    const { studentName, studentClass, school, careerCode, scores, totalScore, tier, matches, streamRecommendation } = params;
    const institutionText = school ? `Assessment completed through ${school}\n` : '';

    const scoresText = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .map(([key, value]) => `  ${key}: ${value} points`)
      .join('\n');

    const careersText = matches.slice(0, 10).map((career, index) => 
      `${index + 1}. ${career.careerName} (${career.matchScore}% match)\n   ${career.description}\n   Tags: ${career.tags.join(', ')}`
    ).join('\n\n');

    return `
CAREER ASSESSMENT RESULTS
========================

STUDENT INFORMATION
${studentName}
${studentClass}
${institutionText}

ASSESSMENT OVERVIEW
- Career Code: ${careerCode}
- Tier: ${tier}
- Total Score: ${totalScore}/180

RIASEC SCORES
${scoresText}

RECOMMENDED STREAM: ${streamRecommendation.recommendedStream}

Reasoning: ${streamRecommendation.reasoning}

Stream Alignment:
- Science: ${streamRecommendation.streamAlignment.science}%
- Commercial: ${streamRecommendation.streamAlignment.commercial}%
- Art: ${streamRecommendation.streamAlignment.art}%

TOP ${matches.length} CAREER MATCHES
${careersText}

NEXT STEPS
1. Review these results with your child
2. Research the top career matches together
3. Consider the recommended stream for academic planning
4. Consult with school counselors
5. Explore internships and mentorship opportunities

Questions? Contact: ${this.supportEmail}

© ${new Date().getFullYear()} Careerly Kids. All rights reserved.
`.trim();
  }
}