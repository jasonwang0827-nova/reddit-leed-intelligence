import {
  loadAnalyzedLeads,
  loadContentPool,
  loadSubreddits,
  nowIso,
  saveContentPool,
  upsertBy
} from "./redditConfigLoader.js";
import type { AnalyzedLead, ContentType, RedditContent } from "./redditTypes.js";

const disclaimer = "This is not legal advice. I’m sharing general patterns I’ve observed. Always check official sources or speak with a qualified professional for your specific case.";

function dateStamp() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function safeIdSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

function pickContentType(index: number): ContentType {
  return (["faq_post", "checklist_post", "case_pattern_post", "discussion_post", "misconception_post"] as ContentType[])[index % 5];
}

function proofOfFundsDraft(contentType: ContentType): Pick<RedditContent, "title" | "body" | "lead_angle"> {
  if (contentType === "checklist_post") {
    return {
      title: "Proof of funds checklist for Canada study permit applications",
      lead_angle: "proof of funds checklist",
      body: `Proof of funds is not only about showing a large balance. The documents should make the source, availability, sponsor relationship, and study budget easy to understand.\n\n${disclaimer}\n\nA practical checklist:\n\n1. Show enough funds for tuition, living costs, and expected expenses.\n2. Explain large or recent deposits instead of leaving them unexplained.\n3. Connect sponsors to the applicant with clear relationship documents.\n4. Keep bank statements, income proof, and tuition payments consistent.\n5. Make sure the financial plan fits the chosen program and location.\n\nA clean financial story is usually stronger than a confusing account with a high number.`
    };
  }
  if (contentType === "case_pattern_post") {
    return {
      title: "A common proof of funds issue: the money is there, but the story is unclear",
      lead_angle: "unclear source of funds",
      body: `Some study permit refusals involving funds are not simply about the balance being too low. The concern can be that the officer cannot understand where the money came from, whether it is stable, or whether the sponsor can realistically support the applicant.\n\n${disclaimer}\n\nCommon weak points include:\n\n1. Sudden deposits with no explanation.\n2. Sponsor income that does not match the amount being provided.\n3. Documents from several accounts with no summary.\n4. A study budget that ignores living costs or dependants.\n\nWhen reviewing a file, clarity and consistency matter as much as the final number.`
    };
  }
  if (contentType === "discussion_post") {
    return {
      title: "For study permit proof of funds, what do people find most confusing?",
      lead_angle: "community proof of funds questions",
      body: `Proof of funds questions often become confusing because applicants hear different advice about balances, sponsors, deposits, and how many months of statements are needed.\n\n${disclaimer}\n\nThe areas I see people struggle with most are:\n\n1. Explaining recent deposits.\n2. Showing sponsor income and relationship clearly.\n3. Matching the budget to tuition and living costs.\n4. Understanding that funds need to look available and credible.\n\nCurious which part others found hardest to prepare or understand.`
    };
  }
  if (contentType === "misconception_post") {
    return {
      title: "A proof of funds misconception: a higher balance does not automatically mean a stronger file",
      lead_angle: "proof of funds misconception",
      body: `A common misunderstanding is that proof of funds is only a number. A high balance can still raise questions if the source is unclear, the account history is inconsistent, or the sponsor's capacity does not match the documents.\n\n${disclaimer}\n\nWhat can matter alongside the balance:\n\n1. Where the funds came from.\n2. Whether the funds are stable and available.\n3. Whether the sponsor can reasonably provide support.\n4. Whether the budget matches tuition, living costs, and family situation.\n\nThe goal is not just to show money. It is to make the financial plan understandable.`
    };
  }
  return {
    title: "Study permit proof of funds: why the explanation can matter as much as the balance",
    lead_angle: "financial proof concern",
    body: `Many applicants focus only on the total amount shown in the bank account. In practice, the explanation behind the funds can matter just as much: source, account history, sponsor capacity, document consistency, and whether the budget fits the study plan.\n\n${disclaimer}\n\nBefore submitting or reapplying, it may help to review:\n\n1. Whether the money source is easy to trace.\n2. Whether the sponsor relationship is documented.\n3. Whether tuition and living costs are realistically covered.\n4. Whether all financial documents tell the same story.\n\nA stronger file is usually about clarity, not just a bigger balance.`
  };
}

function draftForLead(lead: AnalyzedLead, contentType: ContentType): Pick<RedditContent, "title" | "body" | "lead_angle"> {
  if (lead.topic_id === "proof_of_funds") return proofOfFundsDraft(contentType);

  const concern = lead.case_context.main_concern ?? lead.pain_points[0] ?? "application risk";
  const lowerConcern = concern.toLowerCase();
  if (contentType === "checklist_post") {
    return {
      title: "A practical checklist before reapplying after a Canada study permit refusal",
      lead_angle: "reapplication checklist",
      body: `When a study permit is refused, it is tempting to fix one document and submit again quickly. A better first step is to identify what concern the refusal points to and whether the new application actually answers it.\n\n${disclaimer}\n\nA simple review checklist:\n\n1. Read the refusal reasons and map each one to evidence.\n2. Check whether the program choice fits past education or work.\n3. Review whether the study plan explains the future path clearly.\n4. Make sure funds are consistent, traceable, and realistic.\n5. Avoid sending the same file again with only minor edits.\n\nThis kind of review can slow the process down, but it often prevents a rushed second refusal.`
    };
  }
  if (contentType === "case_pattern_post") {
    return {
      title: "A common refusal pattern: good documents, weak overall study logic",
      lead_angle: "case pattern study logic",
      body: `One pattern I notice in study permit refusals is that the applicant may have many documents, but the overall story still feels disconnected. The school, program, finances, career path, and ties may each look acceptable alone, while the full plan still raises questions.\n\n${disclaimer}\n\nExamples of weak logic can include:\n\n1. Choosing a program that repeats prior education without explanation.\n2. Showing funds without explaining source or stability.\n3. Writing a study plan that sounds generic.\n4. Ignoring previous refusal concerns in the new submission.\n\nA stronger application usually makes the parts work together, not just adds more paperwork.`
    };
  }
  if (contentType === "discussion_post") {
    return {
      title: "What would you review first after a study permit refusal?",
      lead_angle: "community discussion refusal review",
      body: `For applicants who receive a study permit refusal, the hardest part is deciding what to review first. Some people focus on finances, some on the study plan, and some on school or program choice.\n\n${disclaimer}\n\nMy own view is that the first review should usually connect the refusal reason to the full application logic:\n\n1. What exactly did the officer question?\n2. Which documents or explanations were missing or unclear?\n3. Does the chosen program make sense for the applicant’s background?\n4. Would a new submission be materially different from the refused one?\n\nCurious how others here would prioritize the review process.`
    };
  }
  if (contentType === "misconception_post") {
    return {
      title: "A study permit refusal misconception: adding more documents is not always the fix",
      lead_angle: "refusal misconception",
      body: `After a refusal, many applicants assume the solution is to add more documents. Sometimes that helps, but the bigger issue is often whether the new submission directly answers the officer's concern.\n\n${disclaimer}\n\nBefore adding documents, it can help to ask:\n\n1. What concern did the refusal reason actually point to?\n2. Does the program choice make sense with the applicant's background?\n3. Are the finances clear and consistent?\n4. Does the study plan explain why this path is reasonable now?\n\nA reapplication should be meaningfully stronger, not just longer.`
    };
  }
  if (lowerConcern.includes("purpose")) {
    return {
      title: "Why do Canada study permit applications get refused for “purpose of visit”?",
      lead_angle: "study permit refusal anxiety",
      body: `I’ve seen many applicants misunderstand this refusal reason. It usually does not only mean the officer doubts the travel purpose. It can also involve whether the program choice, career path, financial background, family ties, and overall study plan make sense together.\n\n${disclaimer}\n\nCommon areas to review before reapplying:\n\n1. Whether the program matches prior education and work history.\n2. Whether the financial documents are clear, consistent, and explainable.\n3. Whether the future plan after graduation is realistic.\n4. Whether family, employment, or home-country ties are explained properly.\n\nBlindly resubmitting the same application usually does not solve the underlying concern.`
    };
  }
  if (lowerConcern.includes("financial") || lead.case_context.budget_issue) {
    return {
      title: "Study permit refusals and proof of funds: what applicants often overlook",
      lead_angle: "proof of funds concern",
      body: `Many applicants focus only on the total amount of money shown in the account. In practice, the logic behind the funds can matter just as much: source, history, sponsor relationship, document consistency, and whether the budget fits the study plan.\n\n${disclaimer}\n\nBefore reapplying, it may help to review:\n\n1. Whether large deposits are explained clearly.\n2. Whether the sponsor relationship and income are documented.\n3. Whether tuition, living costs, and travel costs are covered realistically.\n4. Whether the financial story matches the program and future plan.\n\nA stronger file is usually about clarity and consistency, not just a bigger bank balance.`
    };
  }
  if (lowerConcern.includes("pgwp")) {
    return {
      title: "Questions to ask before choosing a program for PGWP eligibility",
      lead_angle: "PGWP program risk",
      body: `PGWP risk often appears after someone has already enrolled, which makes the situation much harder to fix. Program choice, school type, length of study, delivery mode, and recent policy details can all affect the path.\n\n${disclaimer}\n\nBefore choosing a school or program, applicants should confirm:\n\n1. Whether the institution and program are eligible under current rules.\n2. Whether the program length supports the expected work permit outcome.\n3. Whether online or hybrid delivery changes the risk.\n4. Whether the credential supports the long-term immigration plan.\n\nIt is safer to check these details before paying deposits or changing programs.`
    };
  }
  return {
    title: "Common areas to review before reapplying after a study permit refusal",
    lead_angle: lead.content_angle,
    body: `A refusal can feel like a single-document problem, but it often reflects the full application logic. The useful question is not only “what document should I add?” but “what concern was the officer trying to resolve?”\n\n${disclaimer}\n\nA practical review can include:\n\n1. The refusal reasons and whether they connect to the study plan.\n2. Program choice and whether it fits the applicant’s background.\n3. Financial documents and whether they are consistent.\n4. Family, employment, and home-country ties.\n5. Whether the new submission actually answers the previous concerns.\n\nCurious how others here think about rebuilding an application after a refusal.`
  };
}

export async function generateRedditDrafts(clientId: string, topicId: string, maxDrafts = 5): Promise<RedditContent[]> {
  const [leads, subreddits, existing] = await Promise.all([loadAnalyzedLeads(), loadSubreddits(), loadContentPool()]);
  const targetSubreddit = subreddits[0]?.subreddit ?? "ImmigrationCanada";
  const highValueLeads = leads
    .filter((lead) => lead.topic_id === topicId && ["high", "medium"].includes(lead.lead_signal))
    .slice(0, maxDrafts);

  const drafts = highValueLeads.map((lead, index): RedditContent => {
    const contentType = pickContentType(index);
    const generated = draftForLead(lead, contentType);
    const timestamp = nowIso();
    return {
      content_id: `reddit_post_${dateStamp()}_${safeIdSegment(topicId)}_${String(index + 1).padStart(3, "0")}`,
      client_id: clientId,
      source_type: "reddit_intelligence",
      topic_id: lead.topic_id,
      target_subreddit: targetSubreddit,
      content_type: contentType,
      title: generated.title,
      body: generated.body,
      language: "en",
      status: "draft",
      risk_score: null,
      lead_angle: generated.lead_angle,
      review_status: "pending",
      publish_status: "not_published",
      published_url: null,
      created_at: timestamp,
      updated_at: timestamp
    };
  });

  const merged = upsertBy(existing, drafts, (row) => row.content_id);
  await saveContentPool(merged);
  return drafts;
}
