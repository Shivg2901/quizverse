const fs = require('fs');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Extract text content from a PDF file
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<string>} - Text content of the PDF
 */
async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Generate a quiz based on PDF content
 * @param {string} pdfContent - Text content from the PDF
 * @param {string} topic - Topic for the quiz
 * @param {string} difficulty - Difficulty level
 * @param {number} numQuestions - Number of questions to generate
 * @returns {Promise<Object>} - Generated quiz data
 */
async function generateQuizFromPDF(pdfContent, topic, difficulty = 'medium', numQuestions = 5, questionType = 'mcq') {
  try {
    console.log('[generateQuizFromPDF] Called with:', { topic, difficulty, numQuestions, questionType });
    console.log('[generateQuizFromPDF] PDF content length:', pdfContent.length);

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
Given the following text extracted from a PDF document, generate a ${difficulty}-level quiz about "${topic}" with ${numQuestions} ${questionType === 'short' ? 'short-answer' : 'multiple choice'} questions.

Text from PDF:
${pdfContent.substring(0, 8000)} ${pdfContent.length > 8000 ? '... (text truncated)' : ''}

Format the response as a valid JSON object with this structure:
{
  "quiz": {
    "topic": "${topic}",
    "description": "Brief description of the quiz based on the PDF content",
    "questions": [
      ${questionType === 'short'
        ? `{
            "question": "Question text",
            "correctAnswer": "Expected short answer",
            "explanation": "Explanation for the answer"
          }`
        : `{
            "question": "Question text",
            "options": ["Option1", "Option2", "Option3", "Option4"],
            "correctAnswer": "Correct option text",
            "explanation": "Explanation for the correct answer"
          }`
      }
    ]
  }
}

Do not add anything else outside this JSON.`;

    console.log('[generateQuizFromPDF] Sending prompt to Gemini...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let textResponse = response.text();

    console.log('[generateQuizFromPDF] Gemini response:', textResponse.substring(0, 500));

    const jsonStart = textResponse.indexOf('{');
    const jsonEnd = textResponse.lastIndexOf('}') + 1;

    if (jsonStart === -1 || jsonEnd === 0) {
      console.error('[generateQuizFromPDF] Could not find valid JSON in AI response');
      throw new Error("Could not find valid JSON in the AI response.");
    }

    const jsonString = textResponse.substring(jsonStart, jsonEnd);
    const parsedResponse = JSON.parse(jsonString);

    if (!parsedResponse.quiz || !Array.isArray(parsedResponse.quiz.questions)) {
      console.error('[generateQuizFromPDF] Generated content does not match expected structure');
      throw new Error("Generated content doesn't match expected structure.");
    }

    parsedResponse.quiz.questions = parsedResponse.quiz.questions.map(q => ({
      ...q,
      type: questionType
    }));
    console.log('[generateQuizFromPDF] Parsed quiz:', JSON.stringify(parsedResponse.quiz, null, 2));
    return parsedResponse.quiz;
  } catch (error) {
    console.error('[generateQuizFromPDF] Error:', error);
    return generateFallbackPDFQuiz(pdfContent, topic, difficulty, numQuestions, questionType);
  }
}

function generateFallbackPDFQuiz(pdfContent, topic, difficulty, numQuestions = 5, questionType = 'mcq') {
  const description = `A ${difficulty} quiz about ${topic} based on the provided PDF content.`;
  const questions = [];

  if (questionType === 'short') {
    for (let i = 0; i < numQuestions; i++) {
      questions.push({
        question: `Explain a key concept related to ${topic} from the document.`,
        correctAnswer: `A correct explanation derived from the PDF content.`,
        explanation: `The document discusses several concepts related to ${topic}, such as ...`,
        type: 'short'
      });
    }
  } else {
    questions.push({
      question: `What is the main focus of this document related to ${topic}?`,
      options: [
        `Learning ${topic} concepts`, 
        `${topic} implementation details`, 
        `History of ${topic}`, 
        `${topic} best practices`
      ],
      correctAnswer: `${topic} implementation details`,
      explanation: "It appears to focus on implementation details of the topic.",
      type: 'mcq'
    });
  }

  return {
    topic,
    description,
    questions: questions.slice(0, numQuestions)
  };
}

module.exports = {
  extractTextFromPDF,
  generateQuizFromPDF
};