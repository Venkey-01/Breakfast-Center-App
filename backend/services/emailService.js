const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail({ to, subject, html, from }) {
  const primarySender = from || process.env.RESEND_FROM_EMAIL || 'Breakfast Center <orders@mechanicguru.me>';

  try {
    console.log(`📧 Sending email via Resend to ${to} from "${primarySender}"...`);
    const data = await resend.emails.send({
      from: primarySender,
      to: [to],
      subject: subject,
      html: html,
    });

    if (data.error) {
      console.warn('⚠️ Resend primary sender error:', data.error.message || data.error);
      if (!primarySender.includes('resend.dev')) {
        console.log('🔄 Attempting fallback to onboarding@resend.dev...');
        const fallback = await resend.emails.send({
          from: 'Breakfast Center <onboarding@resend.dev>',
          to: [to],
          subject: subject,
          html: html,
        });
        console.log('✅ Email sent via Resend fallback:', fallback.data?.id || fallback.id);
        return fallback;
      }
    }

    console.log('✅ Email sent successfully via Resend:', data.data?.id || data.id);
    return data;
  } catch (error) {
    console.error('❌ Primary Resend Email Error:', error.message || error);
    try {
      const fallbackData = await resend.emails.send({
        from: 'Breakfast Center <onboarding@resend.dev>',
        to: [to],
        subject: subject,
        html: html,
      });
      console.log('✅ Email sent via Resend fallback:', fallbackData.data?.id || fallbackData.id);
      return fallbackData;
    } catch (e) {
      console.error('❌ Resend fallback also failed:', e.message);
    }
    throw error;
  }
}

module.exports = {
  sendEmail,
};
