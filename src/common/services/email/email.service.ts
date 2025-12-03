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
    this.assessmentUrl = this.configService.get<string>(
      `ASSESSMENT_URL`,
      // 'https://careerlyai.app/assessment/result',
    );
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

  private getEmailSubject(type: TokenType, school?: string): string {
    if (type === TokenType.ENTERPRISE && school) {
      return `Your ${school} Career Assessment Access`;
    }
    return 'Your Career Assessment Access Token';
  }

  private generateTokenEmailHtml(params: SendAccessTokenParams): string {
    const { name, school, token, type, expiresAt, maxUsage } = params;

    const greeting = name ? `Hi ${name}` : 'Hello';

    const dynamicAssessmentUrl=`${this.assessmentUrl}?token=${token}`;
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
                  View Your Results
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

View your results: ${this.assessmentUrl}

© ${new Date().getFullYear()} Careerly. All rights reserved.
`.trim();
  }
}
