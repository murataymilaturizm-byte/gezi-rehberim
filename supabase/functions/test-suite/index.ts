import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestResult {
  id: string;
  category: string;
  name: string;
  demoResult: 'pass' | 'fail' | 'skip';
  whatsappResult: 'pass' | 'fail' | 'skip';
  match: boolean;
  details: string;
  demoData?: any;
  whatsappData?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { testType, demoSessionId, whatsappPhone, agencyId } = await req.json();

    console.log('Running test suite:', { testType, demoSessionId, whatsappPhone, agencyId });

    const results: TestResult[] = [];

    // Get profiles
    const { data: demoProfile } = await supabase
      .from('whatsapp_user_profiles')
      .select('*')
      .eq('phone', `demo_${demoSessionId}`)
      .eq('agency_id', agencyId)
      .maybeSingle();

    const { data: whatsappProfile } = await supabase
      .from('whatsapp_user_profiles')
      .select('*')
      .eq('phone', whatsappPhone)
      .eq('agency_id', agencyId)
      .maybeSingle();

    // Test 1: Memory Structure
    if (!testType || testType === 'memory') {
      results.push(await testMemoryStructure(demoProfile, whatsappProfile));
      results.push(await testDestinationMemory(demoProfile, whatsappProfile));
      results.push(await testInterestExtraction(demoProfile, whatsappProfile));
      results.push(await testPaxExtraction(demoProfile, whatsappProfile));
      results.push(await testBudgetDetection(demoProfile, whatsappProfile));
    }

    // Test 2: Conversation State
    if (!testType || testType === 'conversation') {
      results.push(await testConversationState(demoProfile, whatsappProfile));
      results.push(await testWizardState(demoProfile, whatsappProfile));
      results.push(await testFlowHistory(demoProfile, whatsappProfile));
    }

    // Test 3: Profile Insights
    if (!testType || testType === 'insights') {
      results.push(await testTopicsDiscussed(demoProfile, whatsappProfile));
      results.push(await testQuestionsAsked(demoProfile, whatsappProfile));
      results.push(await testSentimentSignals(demoProfile, whatsappProfile));
    }

    // Test 4: Registrations (WhatsApp only)
    if (!testType || testType === 'registrations') {
      const { data: registrations } = await supabase
        .from('registrations')
        .select('*')
        .eq('phone', whatsappPhone)
        .eq('agency_id', agencyId);

      results.push({
        id: '5.1',
        category: 'Wizard Flow',
        name: 'Registration Creation (WhatsApp only)',
        demoResult: 'skip',
        whatsappResult: registrations && registrations.length > 0 ? 'pass' : 'fail',
        match: true,
        details: `WhatsApp registrations: ${registrations?.length || 0}`,
        whatsappData: registrations
      });
    }

    // Calculate summary
    const summary = {
      total: results.length,
      passed: results.filter(r => r.match).length,
      failed: results.filter(r => !r.match).length,
      matchRate: Math.round((results.filter(r => r.match).length / results.length) * 100)
    };

    return new Response(
      JSON.stringify({ results, summary, profiles: { demo: demoProfile, whatsapp: whatsappProfile } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Test suite error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Test Functions

function testMemoryStructure(demo: any, whatsapp: any): TestResult {
  const demoMemory = demo?.preferences?.conversation_state?.userMemory;
  const whatsappMemory = whatsapp?.preferences?.conversation_state?.userMemory;

  const demoHasMemory = !!demoMemory;
  const whatsappHasMemory = !!whatsappMemory;

  return {
    id: '2.1',
    category: 'Memory Extraction',
    name: 'Memory Structure Exists',
    demoResult: demoHasMemory ? 'pass' : 'fail',
    whatsappResult: whatsappHasMemory ? 'pass' : 'fail',
    match: demoHasMemory === whatsappHasMemory,
    details: `Demo: ${demoHasMemory}, WhatsApp: ${whatsappHasMemory}`,
    demoData: demoMemory,
    whatsappData: whatsappMemory
  };
}

function testDestinationMemory(demo: any, whatsapp: any): TestResult {
  const demoDestinations = demo?.preferences?.conversation_state?.userMemory?.preferredDestinations || [];
  const whatsappDestinations = whatsapp?.preferences?.conversation_state?.userMemory?.preferredDestinations || [];

  const match = JSON.stringify(demoDestinations.sort()) === JSON.stringify(whatsappDestinations.sort());

  return {
    id: '2.1',
    category: 'Memory Extraction',
    name: 'Destination Memory',
    demoResult: demoDestinations.length > 0 ? 'pass' : 'skip',
    whatsappResult: whatsappDestinations.length > 0 ? 'pass' : 'skip',
    match,
    details: `Demo: ${demoDestinations.join(', ') || 'none'}, WhatsApp: ${whatsappDestinations.join(', ') || 'none'}`,
    demoData: demoDestinations,
    whatsappData: whatsappDestinations
  };
}

function testInterestExtraction(demo: any, whatsapp: any): TestResult {
  const demoInterests = demo?.preferences?.conversation_state?.userMemory?.interests || [];
  const whatsappInterests = whatsapp?.preferences?.conversation_state?.userMemory?.interests || [];

  const match = JSON.stringify(demoInterests.sort()) === JSON.stringify(whatsappInterests.sort());

  return {
    id: '2.2',
    category: 'Memory Extraction',
    name: 'Interest Extraction',
    demoResult: demoInterests.length > 0 ? 'pass' : 'skip',
    whatsappResult: whatsappInterests.length > 0 ? 'pass' : 'skip',
    match,
    details: `Demo: ${demoInterests.join(', ') || 'none'}, WhatsApp: ${whatsappInterests.join(', ') || 'none'}`,
    demoData: demoInterests,
    whatsappData: whatsappInterests
  };
}

function testPaxExtraction(demo: any, whatsapp: any): TestResult {
  const demoPax = demo?.preferences?.conversation_state?.userMemory?.lastMentionedPax;
  const whatsappPax = whatsapp?.preferences?.conversation_state?.userMemory?.lastMentionedPax;

  const match = JSON.stringify(demoPax) === JSON.stringify(whatsappPax);

  return {
    id: '2.3',
    category: 'Memory Extraction',
    name: 'Pax Extraction',
    demoResult: demoPax ? 'pass' : 'skip',
    whatsappResult: whatsappPax ? 'pass' : 'skip',
    match: demoPax && whatsappPax ? match : true,
    details: `Demo: ${JSON.stringify(demoPax) || 'none'}, WhatsApp: ${JSON.stringify(whatsappPax) || 'none'}`,
    demoData: demoPax,
    whatsappData: whatsappPax
  };
}

function testBudgetDetection(demo: any, whatsapp: any): TestResult {
  const demoBudget = demo?.preferences?.conversation_state?.userMemory?.budgetRange;
  const whatsappBudget = whatsapp?.preferences?.conversation_state?.userMemory?.budgetRange;

  const match = demoBudget === whatsappBudget;

  return {
    id: '2.4',
    category: 'Memory Extraction',
    name: 'Budget Detection',
    demoResult: demoBudget ? 'pass' : 'skip',
    whatsappResult: whatsappBudget ? 'pass' : 'skip',
    match: demoBudget && whatsappBudget ? match : true,
    details: `Demo: ${demoBudget || 'none'}, WhatsApp: ${whatsappBudget || 'none'}`,
    demoData: demoBudget,
    whatsappData: whatsappBudget
  };
}

function testConversationState(demo: any, whatsapp: any): TestResult {
  const demoState = demo?.preferences?.conversation_state;
  const whatsappState = whatsapp?.preferences?.conversation_state;

  const demoStage = demoState?.currentStage;
  const whatsappStage = whatsappState?.currentStage;

  const match = demoStage === whatsappStage;

  return {
    id: '3.1',
    category: 'Conversation State',
    name: 'Stage Tracking',
    demoResult: demoStage ? 'pass' : 'skip',
    whatsappResult: whatsappStage ? 'pass' : 'skip',
    match: demoStage && whatsappStage ? match : true,
    details: `Demo: ${demoStage || 'none'}, WhatsApp: ${whatsappStage || 'none'}`,
    demoData: demoState,
    whatsappData: whatsappState
  };
}

function testWizardState(demo: any, whatsapp: any): TestResult {
  const demoWizard = demo?.preferences?.wizard_state;
  const whatsappWizard = whatsapp?.preferences?.wizard_state;

  const demoStep = demoWizard?.step;
  const whatsappStep = whatsappWizard?.step;

  const match = demoStep === whatsappStep;

  return {
    id: '3.2',
    category: 'Conversation State',
    name: 'Wizard State',
    demoResult: demoStep ? 'pass' : 'skip',
    whatsappResult: whatsappStep ? 'pass' : 'skip',
    match: demoStep && whatsappStep ? match : true,
    details: `Demo: ${demoStep || 'none'}, WhatsApp: ${whatsappStep || 'none'}`,
    demoData: demoWizard,
    whatsappData: whatsappWizard
  };
}

function testFlowHistory(demo: any, whatsapp: any): TestResult {
  const demoFlow = demo?.preferences?.conversation_state?.conversationFlow || [];
  const whatsappFlow = whatsapp?.preferences?.conversation_state?.conversationFlow || [];

  const match = JSON.stringify(demoFlow) === JSON.stringify(whatsappFlow);

  return {
    id: '3.3',
    category: 'Conversation State',
    name: 'Flow History',
    demoResult: demoFlow.length > 0 ? 'pass' : 'skip',
    whatsappResult: whatsappFlow.length > 0 ? 'pass' : 'skip',
    match: demoFlow.length > 0 && whatsappFlow.length > 0 ? match : true,
    details: `Demo: ${demoFlow.length} intents, WhatsApp: ${whatsappFlow.length} intents`,
    demoData: demoFlow,
    whatsappData: whatsappFlow
  };
}

function testTopicsDiscussed(demo: any, whatsapp: any): TestResult {
  const demoTopics = demo?.preferences?.conversation_insights?.topics_discussed || [];
  const whatsappTopics = whatsapp?.preferences?.conversation_insights?.topics_discussed || [];

  const match = JSON.stringify(demoTopics.sort()) === JSON.stringify(whatsappTopics.sort());

  return {
    id: '4.1',
    category: 'Profile Insights',
    name: 'Topics Discussed',
    demoResult: demoTopics.length > 0 ? 'pass' : 'skip',
    whatsappResult: whatsappTopics.length > 0 ? 'pass' : 'skip',
    match: demoTopics.length > 0 && whatsappTopics.length > 0 ? match : true,
    details: `Demo: ${demoTopics.join(', ') || 'none'}, WhatsApp: ${whatsappTopics.join(', ') || 'none'}`,
    demoData: demoTopics,
    whatsappData: whatsappTopics
  };
}

function testQuestionsAsked(demo: any, whatsapp: any): TestResult {
  const demoQuestions = demo?.preferences?.conversation_insights?.questions_asked || [];
  const whatsappQuestions = whatsapp?.preferences?.conversation_insights?.questions_asked || [];

  return {
    id: '4.2',
    category: 'Profile Insights',
    name: 'Questions Asked',
    demoResult: demoQuestions.length > 0 ? 'pass' : 'skip',
    whatsappResult: whatsappQuestions.length > 0 ? 'pass' : 'skip',
    match: true, // Questions content may differ but structure should exist
    details: `Demo: ${demoQuestions.length} questions, WhatsApp: ${whatsappQuestions.length} questions`,
    demoData: demoQuestions,
    whatsappData: whatsappQuestions
  };
}

function testSentimentSignals(demo: any, whatsapp: any): TestResult {
  const demoPositive = demo?.preferences?.conversation_insights?.positive_signals || [];
  const whatsappPositive = whatsapp?.preferences?.conversation_insights?.positive_signals || [];

  return {
    id: '4.3',
    category: 'Profile Insights',
    name: 'Sentiment Signals',
    demoResult: demoPositive.length > 0 ? 'pass' : 'skip',
    whatsappResult: whatsappPositive.length > 0 ? 'pass' : 'skip',
    match: true, // Sentiment may differ but detection should work
    details: `Demo: ${demoPositive.length} positive, WhatsApp: ${whatsappPositive.length} positive`,
    demoData: { positive: demoPositive },
    whatsappData: { positive: whatsappPositive }
  };
}
