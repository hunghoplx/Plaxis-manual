import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;

export interface Message {
  role: "user" | "model";
  content: string;
  plotData?: any;
}

export const MANUALS = [
  {
    id: "von-mises",
    title: "von Mises Yield Criterion",
    content: "The von Mises yield criterion suggests that yielding of a materials begins when the second invariant of deviatoric stress J2 reaches a critical value. It is represented as a cylinder in principal stress space.",
    formula: "sqrt(0.5 * ((s1-s2)^2 + (s2-s3)^2 + (s3-s1)^2)) = sy"
  },
  {
    id: "tresca",
    title: "Tresca Yield Criterion",
    content: "The Tresca yield criterion states that yielding occurs when the maximum shear stress reaches a critical value. It is represented as a hexagonal prism in principal stress space.",
    formula: "max(|s1-s2|, |s2-s3|, |s3-s1|) = sy"
  },
  {
    id: "drucker-prager",
    title: "Drucker-Prager Yield Criterion",
    content: "The Drucker-Prager yield criterion is a pressure-dependent model for determining whether a material has failed or yielded. It is often used for soil and concrete.",
    formula: "sqrt(J2) + alpha*I1 = k"
  },
  {
    id: "mohr-coulomb",
    title: "Mohr-Coulomb Failure Criterion",
    content: "The Mohr-Coulomb failure criterion is a mathematical model describing the response of brittle materials such as rocks and soils to shear stress as well as normal stress. It includes parameters for cohesion, internal friction angle, and often a tension cutoff for geological materials.",
    formula: "tau = c + sigma_n * tan(phi)",
    details: "In principal stress space, it forms an irregular hexagonal pyramid. Geological applications often consider effective stress (sigma' = sigma - Pf) and tensile strength limits."
  },
  {
    id: "hoek-brown",
    title: "Hoek-Brown Failure Criterion",
    content: "The Hoek-Brown failure criterion is an empirical model used in rock mechanics to predict the strength of a rock mass. It accounts for the reduction in strength from intact rock to a jointed rock mass using GSI.",
    formula: "s1 = s3 + sci * (mb * s3/sci + s)^a",
    details: "Parameters include sci (uniaxial compressive strength of intact rock), GSI (Geological Strength Index), mi (intact rock constant), and D (disturbance factor)."
  }
];

const SYSTEM_INSTRUCTION = `
You are a highly specialized AI Agent for Material Science and Structural Engineering.
Your primary role is to assist users with technical questions about material models, yield surfaces, and structural analysis.

You have access to the following manuals:
${MANUALS.map(m => `- ${m.title}: ${m.content}`).join("\n")}

When a user asks about a specific model, provide a detailed explanation, tutorial, or example as requested.
If the user asks to "visualize" or "plot" a yield surface, use the 'visualize_yield_surface' tool.
The visualization component supports three plot types:
- 's1-s2': Principal stress plane (sigma1 vs sigma2, sigma3=0).
- 's1-s3': Failure envelope in sigma1 vs sigma3 space.
- 'p-q': Failure envelope in mean stress (p) vs shear stress (q) space.

Available models for visualization:
- 'von-mises': Parameters: { yield_stress: number }
- 'tresca': Parameters: { yield_stress: number }
- 'drucker-prager': Parameters: { alpha: number, k: number, friction_angle: number, cohesion: number }
- 'mohr-coulomb': Parameters: { friction_angle: number, cohesion: number, tension_cutoff: number, pore_pressure: number, sigma3_confining: number }
- 'hoek-brown': Parameters: { sci: number, gsi: number, mi: number, d_factor: number, sigma3_confining: number }

Always be precise, technical, and helpful.
`;

export async function chatWithAgent(messages: Message[]) {
  if (!API_KEY) throw new Error("GEMINI_API_KEY is missing");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const tools = [
    {
      functionDeclarations: [
        {
          name: "visualize_yield_surface",
          description: "Generates data to plot one or two yield surfaces for comparison.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              model_id: {
                type: Type.STRING,
                description: "The ID of the primary model to visualize.",
              },
              plot_type: {
                type: Type.STRING,
                description: "The type of plot to generate: 's1-s2', 's1-s3', or 'p-q'. Default is 's1-s2'.",
                enum: ["s1-s2", "s1-s3", "p-q"]
              },
              parameters: {
                type: Type.OBJECT,
                description: "Parameters for the primary model.",
                properties: {
                  yield_stress: { type: Type.NUMBER },
                  alpha: { type: Type.NUMBER },
                  k: { type: Type.NUMBER },
                  friction_angle: { type: Type.NUMBER },
                  cohesion: { type: Type.NUMBER },
                  tension_cutoff: { type: Type.NUMBER },
                  pore_pressure: { type: Type.NUMBER },
                  sigma_x: { type: Type.NUMBER },
                  sigma_y: { type: Type.NUMBER },
                  tau_xy: { type: Type.NUMBER },
                  sci: { type: Type.NUMBER },
                  gsi: { type: Type.NUMBER },
                  mi: { type: Type.NUMBER },
                  d_factor: { type: Type.NUMBER },
                  sigma3_confining: { type: Type.NUMBER, description: "Effective confining stress (sigma'3) for shear strength calculation." }
                }
              },
              compare_with: {
                type: Type.OBJECT,
                description: "Optional second model to compare with.",
                properties: {
                  model_id: { type: Type.STRING },
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      yield_stress: { type: Type.NUMBER },
                      alpha: { type: Type.NUMBER },
                      k: { type: Type.NUMBER },
                      friction_angle: { type: Type.NUMBER },
                      cohesion: { type: Type.NUMBER },
                      tension_cutoff: { type: Type.NUMBER },
                      pore_pressure: { type: Type.NUMBER },
                      sigma_x: { type: Type.NUMBER },
                      sigma_y: { type: Type.NUMBER },
                      tau_xy: { type: Type.NUMBER },
                      sci: { type: Type.NUMBER },
                      gsi: { type: Type.NUMBER },
                      mi: { type: Type.NUMBER },
                      d_factor: { type: Type.NUMBER },
                      sigma3_confining: { type: Type.NUMBER }
                    }
                  }
                }
              }
            },
            required: ["model_id"],
          },
        },
      ],
    },
  ];

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: messages.map(m => ({
      role: m.role,
      parts: [{ text: m.content }]
    })),
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: tools,
    },
  });

  return response;
}
