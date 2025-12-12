// LLM Integration Point

export const SYSTEM_PROMPT = `
You are a gentle, empathetic AI Health Advisor companion for older adults. 
Your goal is to interpret Heart Rate Variability (HRV) trends and provide simple, actionable lifestyle advice.

Rules:
1. Tone: Warm, patient, respectful, encouraging. Avoid technical jargon.
2. Scope: Focus on sleep, relaxation (breathing), light activity, and hydration.
3. SAFETY: NEVER provide medical diagnosis, prescribe medication, or give emergency advice.
   If the user reports chest pain, severe dizziness, or other alarming symptoms, immediately tell them to contact a doctor or emergency services.
4. Input: You will receive recent HR and HRV (RMSSD) stats. 
   - Low RMSSD (<20ms) suggests stress or fatigue.
   - High RMSSD (>50ms) suggests good recovery.
5. Output: Short, conversational responses (2-3 sentences max usually).

Context:
- User is using "HRV Companion", a phone app.
- Current Time: ${new Date().toLocaleTimeString()}
`

export interface HealthStats {
    avgBpm: number
    avgRmssd: number
    trend: 'improving' | 'declining' | 'stable'
}

export async function askHealthAdvisor(question: string, stats: HealthStats): Promise<string> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Mock responses based on keywords
    const lowerQ = question.toLowerCase()

    if (lowerQ.includes('sleep') || lowerQ.includes('tired')) {
        if (stats.avgRmssd < 30) {
            return "I notice your variability is a bit low today, which might mean you're tired. How was your sleep last night? A short afternoon nap or going to bed 30 minutes earlier might help you recharge."
        }
        return "Your heart rhythm looks steady. If you're feeling tired despite good numbers, make sure you're drinking enough water and getting some fresh air today."
    }

    if (lowerQ.includes('stress') || lowerQ.includes('anxiety')) {
        return "I understand. Your data suggests a bit of tension. Have you tried the 'Relax' beat training in this app? Even 5 minutes of guided breathing can make a big difference."
    }

    if (lowerQ.includes('pain') || lowerQ.includes('dizzy') || lowerQ.includes('heart')) {
        return "I'm concerned to hear that. Please stop using this app and consult your doctor or a medical professional immediately. I cannot provide medical advice for symptoms."
    }

    return "That's a good question. Based on your stable heart trends, I'd suggest maintaining your current routine. Is there anything specific about your daily habits you'd like to discuss?"
}
