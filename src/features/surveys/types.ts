export type QuestionType = "single_choice" | "multiple_choice" | "likert" | "text";

export interface SurveyQuestion {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[]; // required for single_choice and multiple_choice
  required: boolean;
}

export interface Survey {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  status: "draft" | "published" | "closed" | "archived";
  questions: SurveyQuestion[];
  targetAudience: { type: "all" | "tower"; tower?: string };
  minResponsesForResults: number; // default 5
  responseCount: number;
  publishedAt?: Date;
  closedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SurveyResponse {
  id: string; // {surveyId}_{unitId}
  surveyId: string;
  tenantId: string;
  unitId: string;
  answers: SurveyAnswer[];
  respondedAt: Date;
}

export interface SurveyAnswer {
  questionId: string;
  value: string | string[] | number; // string for text, string[] for multiple_choice, number for likert
}

export interface SurveyResultsAggregated {
  totalInvited: number;
  totalResponded: number;
  participationRate: number;
  byQuestion: {
    [questionId: string]: {
      type: QuestionType;
      counts?: { [optionOrValue: string]: number }; // for single_choice, multiple_choice, likert
      textAnswers?: string[]; // for text
    };
  };
}
