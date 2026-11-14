import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useAppDispatch } from '../app/hooks';
import { addNotification } from '../features/notifications/notificationsSlice';
import { catIntakeSchema, type CatIntakeForm } from '../schemas/catIntakeSchema';
import {
  fetchFoundCatDecisionTree,
  submitIntakeReport,
  type FoundCatDecisionTree,
} from '../services/assistantApi';
import { GLOBAL_PUBLIC_SHELTERS } from '../data/shelters';
import { useTranslation } from '../i18n/useTranslation';

type AssistantMode = 'assistant' | 'form';

export function IntakePage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState<AssistantMode>('form');
  const [tree, setTree] = useState<FoundCatDecisionTree | null>(null);
  const [treeLoading, setTreeLoading] = useState<boolean>(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const loadTree = () => {
    setTreeLoading(true);
    setTreeError(null);
    fetchFoundCatDecisionTree()
      .then((data) => {
        setTree(data);
        setCurrentNodeId((prev) => prev ?? data.entry_node_id);
      })
      .catch(() => {
        setTreeError(t('intake.errorAssistant'));
      })
      .finally(() => {
        setTreeLoading(false);
      });
  };

  useEffect(() => {
    if (activeTab === 'assistant' && !tree && !treeLoading && !treeError) {
      loadTree();
    }
  }, [activeTab, tree, treeLoading, treeError]);

  const handleSelectAnswer = (nextNodeId: string) => {
    if (currentNodeId) {
      setHistory((prev) => [...prev, currentNodeId]);
    }
    setCurrentNodeId(nextNodeId);
  };

  const handleBack = () => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const nextHistory = [...prev];
      const previousNodeId = nextHistory.pop()!;
      setCurrentNodeId(previousNodeId);
      return nextHistory;
    });
  };

  const handleStartOver = () => {
    setHistory([]);
    if (tree) {
      setCurrentNodeId(tree.entry_node_id);
    }
  };

  const currentNode = tree
    ? (tree.nodes.find((n) => n.id === currentNodeId) ??
       tree.nodes.find((n) => n.id === tree.entry_node_id) ??
       null)
    : null;

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<CatIntakeForm>({
    resolver: zodResolver(catIntakeSchema),
    defaultValues: {
      catName: '',
      reporterEmail: '',
      urgency: 'medium',
      description: '',
    },
  });

  const submitReport = handleSubmit(async (data) => {
    try {
      await submitIntakeReport(data);
      dispatch(addNotification(t('intake.reportQueued'), 'success'));
      reset();
    } catch (err: unknown) {
      const detail = (err as { detail?: string })?.detail;
      const msg = detail
        ? `${t('intake.submitFailed')}: ${detail}`
        : t('intake.submitFailed');
      dispatch(addNotification(msg, 'error'));
    }
  });

  return (
    <section className="form-page max-w-4xl mx-auto py-8 px-4" aria-labelledby="intake-heading">
      {/* Mode navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-4 border-b border-surface-container">
        <div>
          <p className="eyebrow text-xs uppercase tracking-widest text-primary font-bold">{t('intake.eyebrow')}</p>
          <h1 id="intake-heading" className="font-headline-lg text-headline-lg text-on-background">
            {t('intake.title')}
          </h1>
        </div>
        <div className="flex bg-surface-container rounded-xl p-1 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('assistant')}
            className={`px-4 py-2 rounded-lg font-label-md text-label-md transition-all cursor-pointer ${
              activeTab === 'assistant' ? 'bg-white shadow text-on-background font-bold' : 'text-secondary hover:text-on-background'
            }`}
          >
            {t('intake.tabAssistant')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`px-4 py-2 rounded-lg font-label-md text-label-md transition-all cursor-pointer ${
              activeTab === 'form' ? 'bg-white shadow text-on-background font-bold' : 'text-secondary hover:text-on-background'
            }`}
          >
            {t('intake.tabForm')}
          </button>
        </div>
      </div>

      {activeTab === 'assistant' ? (
        <div className="space-y-6">
          {treeLoading && (
            <div className="flex items-center justify-center py-12 gap-3" role="status">
              <span className="material-symbols-outlined text-[32px] text-secondary animate-spin">
                progress_activity
              </span>
              <span className="font-body-md text-secondary">{t('intake.loadingAssistant')}</span>
            </div>
          )}

          {treeError && !treeLoading && (
            <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-3" role="alert">
              <span className="material-symbols-outlined text-error text-[40px]">error</span>
              <p className="text-secondary font-body-md">{treeError}</p>
              <button
                type="button"
                onClick={loadTree}
                className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold font-label-md cursor-pointer hover:shadow-md transition-all"
              >
                {t('intake.retry')}
              </button>
            </div>
          )}

          {tree && (
            <>
              {tree.safety_notice && (
                <div
                  className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start gap-3"
                  role="note"
                  aria-label="Safety notice"
                >
                  <span className="material-symbols-outlined text-amber-700 shrink-0 text-[22px]">
                    info
                  </span>
                  <p className="font-body-sm leading-relaxed">{tree.safety_notice}</p>
                </div>
              )}

              {currentNode && currentNode.type === 'question' && (
                <div className="space-y-6 bg-white p-6 rounded-2xl border border-surface-container">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      {t('intake.question')}
                    </span>
                    <h2 className="font-headline-md text-headline-md text-on-background mt-1">
                      {currentNode.prompt}
                    </h2>
                  </div>

                  {currentNode.guidance && currentNode.guidance.length > 0 && (
                    <div className="p-4 rounded-xl bg-surface-container-low text-secondary text-sm space-y-1">
                      {currentNode.guidance.map((g, idx) => (
                        <p key={idx}>• {g}</p>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 pt-2">
                    {currentNode.answers?.map((answer) => (
                      <button
                        key={answer.id}
                        type="button"
                        onClick={() => handleSelectAnswer(answer.next_node_id)}
                        className="p-4 rounded-xl border border-surface-container hover:border-primary hover:bg-primary/5 transition-all text-left cursor-pointer flex flex-col justify-between group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-on-background group-hover:text-primary">
                            {answer.label}
                          </span>
                          <span className="material-symbols-outlined text-secondary group-hover:text-primary text-[20px] transition-transform group-hover:translate-x-1">
                            arrow_forward
                          </span>
                        </div>
                        {answer.guidance && answer.guidance.length > 0 && (
                          <p className="text-xs text-secondary mt-1">
                            {answer.guidance.join(' ')}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-surface-container">
                    {history.length > 0 ? (
                      <button
                        type="button"
                        onClick={handleBack}
                        className="px-4 py-2 rounded-xl border border-surface-container hover:bg-surface-container text-sm font-label-md inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                        {t('intake.back')}
                      </button>
                    ) : <div />}
                    <button
                      type="button"
                      onClick={handleStartOver}
                      className="px-4 py-2 rounded-xl text-secondary hover:text-on-background text-sm font-label-md cursor-pointer"
                    >
                      {t('intake.startOver')}
                    </button>
                  </div>
                </div>
              )}

              {currentNode && currentNode.type === 'outcome' && (
                <div
                  className={`p-6 rounded-2xl border-2 space-y-6 ${
                    currentNode.severity === 'emergency'
                      ? 'bg-red-50/60 border-red-300'
                      : 'bg-white border-surface-container'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`material-symbols-outlined text-[32px] shrink-0 ${
                        currentNode.severity === 'emergency' ? 'text-error' : 'text-primary'
                      }`}
                    >
                      {currentNode.severity === 'emergency' ? 'warning' : 'task_alt'}
                    </span>
                    <div>
                      <span
                        className={`text-xs font-bold uppercase tracking-wider ${
                          currentNode.severity === 'emergency' ? 'text-error' : 'text-primary'
                        }`}
                      >
                        {currentNode.severity === 'emergency' ? t('intake.emergencyStep') : t('intake.recommendedNextSteps')}
                      </span>
                      <h2 className="font-headline-md text-headline-md text-on-background font-bold mt-1">
                        {currentNode.title}
                      </h2>
                    </div>
                  </div>

                  {currentNode.guidance && currentNode.guidance.length > 0 && (
                    <div className="space-y-2 text-sm font-body-md text-neutral-800">
                      {currentNode.guidance.map((step, idx) => (
                        <p key={idx} className="flex items-start gap-2">
                          <span className="font-bold text-secondary">{idx + 1}.</span>
                          <span>{step}</span>
                        </p>
                      ))}
                    </div>
                  )}

                  {currentNode.severity === 'emergency' && (
                    <div>
                      <h3 className="font-headline-md text-headline-md text-on-background mb-3 text-base font-bold">
                        {t('intake.emergencyVets')}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {GLOBAL_PUBLIC_SHELTERS.filter((l) => l.type === 'vet').slice(0, 4).map((vet) => (
                          <div
                            key={vet.id}
                            className="p-4 bg-white rounded-xl border border-surface-container shadow-sm flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="font-bold text-on-background text-sm">{vet.name}</h4>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                                  {t('intake.verifiedVet')}
                                </span>
                              </div>
                              <p className="text-secondary text-xs mb-3">{vet.address}</p>
                            </div>
                            <div className="flex gap-2">
                              <a
                                href={`tel:${vet.phone}`}
                                className="flex-1 px-3 py-2 rounded-xl bg-error text-white font-bold text-xs text-center flex items-center justify-center gap-1 hover:brightness-105"
                              >
                                <span className="material-symbols-outlined text-[14px]">call</span>
                                {vet.phone}
                              </a>
                              <Link
                                to="/shelters"
                                className="px-3 py-2 rounded-xl border border-surface-container hover:bg-surface-container text-xs text-center"
                              >
                                {t('intake.more')}
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-surface-container">
                    {currentNode.severity === 'emergency' ? (
                      <Link
                        to="/report-sighting"
                        className="px-5 py-2.5 rounded-xl bg-on-background text-white font-bold text-sm shadow-sm hover:brightness-105"
                      >
                        {t('intake.logUrgentSighting')}
                      </Link>
                    ) : (
                      <Link
                        to="/report-sighting"
                        className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm shadow-sm hover:brightness-105"
                      >
                        {t('intake.reportSighting')}
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveTab('form')}
                      className="px-5 py-2.5 rounded-xl border border-primary text-primary font-bold text-sm hover:bg-primary/5 transition-colors cursor-pointer"
                    >
                      {t('intake.fillIntakeForm')}
                    </button>
                    {currentNode.links?.map((link, idx) => {
                      const target = link.endpoint.includes('nearby-help') ? '/shelters' : link.endpoint;
                      return target.startsWith('/') ? (
                        <Link
                          key={idx}
                          to={target}
                          className="px-5 py-2.5 rounded-xl border border-surface-container hover:bg-surface-container text-sm font-label-md"
                        >
                          {link.label}
                        </Link>
                      ) : (
                        <a
                          key={idx}
                          href={target}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-5 py-2.5 rounded-xl border border-surface-container hover:bg-surface-container text-sm font-label-md"
                        >
                          {link.label}
                        </a>
                      );
                    })}
                    <Link
                      to="/missing"
                      className="px-5 py-2.5 rounded-xl border border-surface-container hover:bg-surface-container text-sm font-label-md"
                    >
                      {t('intake.searchMissingCats')}
                    </Link>
                    {history.length > 0 && (
                      <button
                        type="button"
                        onClick={handleBack}
                        className="px-4 py-2.5 rounded-xl border border-surface-container hover:bg-surface-container text-sm font-label-md ml-auto cursor-pointer"
                      >
                        {t('intake.back')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleStartOver}
                      className={`px-4 py-2.5 rounded-xl text-secondary hover:text-on-background text-sm font-label-md cursor-pointer ${
                        history.length === 0 ? 'ml-auto' : ''
                      }`}
                    >
                      {t('intake.startOver')}
                    </button>
                  </div>
                </div>
              )}

              {!currentNode && !treeLoading && (
                <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-3" role="alert">
                  <span className="material-symbols-outlined text-amber-700 text-[40px]">warning</span>
                  <p className="text-secondary font-body-md">{t('intake.stepNotFound')}</p>
                  <button
                    type="button"
                    onClick={handleStartOver}
                    className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold font-label-md cursor-pointer hover:shadow-md transition-all"
                  >
                    {t('intake.startOver')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* Direct Intake Form */
        <form className="intake-form space-y-4 bg-white p-6 rounded-2xl border border-surface-container" onSubmit={submitReport} noValidate>
          <div className="field">
            <label htmlFor="catName" className="block text-sm font-bold text-on-background mb-1">{t('intake.catName')}</label>
            <input
              id="catName"
              type="text"
              className="w-full bg-[#F0F0F0] rounded-xl px-4 py-2.5 font-body-md border-none focus:ring-2 focus:ring-primary"
              aria-invalid={Boolean(errors.catName)}
              aria-describedby={errors.catName ? 'catName-error' : undefined}
              {...register('catName')}
            />
            {errors.catName ? (
              <p className="field-error text-error text-xs mt-1" id="catName-error" role="alert">
                {errors.catName.message}
              </p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="reporterEmail" className="block text-sm font-bold text-on-background mb-1">{t('intake.reporterEmail')}</label>
            <input
              id="reporterEmail"
              type="email"
              className="w-full bg-[#F0F0F0] rounded-xl px-4 py-2.5 font-body-md border-none focus:ring-2 focus:ring-primary"
              aria-invalid={Boolean(errors.reporterEmail)}
              aria-describedby={errors.reporterEmail ? 'reporterEmail-error' : undefined}
              {...register('reporterEmail')}
            />
            {errors.reporterEmail ? (
              <p className="field-error text-error text-xs mt-1" id="reporterEmail-error" role="alert">
                {errors.reporterEmail.message}
              </p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="urgency" className="block text-sm font-bold text-on-background mb-1">{t('intake.urgency')}</label>
            <select
              id="urgency"
              className="w-full bg-[#F0F0F0] rounded-xl px-4 py-2.5 font-body-md border-none focus:ring-2 focus:ring-primary"
              {...register('urgency')}
            >
              <option value="low">{t('intake.urgencyLow')}</option>
              <option value="medium">{t('intake.urgencyMedium')}</option>
              <option value="high">{t('intake.urgencyHigh')}</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="description" className="block text-sm font-bold text-on-background mb-1">{t('intake.description')}</label>
            <textarea
              id="description"
              rows={5}
              className="w-full bg-[#F0F0F0] rounded-xl px-4 py-2.5 font-body-md border-none focus:ring-2 focus:ring-primary"
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? 'description-error' : undefined}
              {...register('description')}
            />
            {errors.description ? (
              <p className="field-error text-error text-xs mt-1" id="description-error" role="alert">
                {errors.description.message}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3 rounded-xl bg-primary text-on-primary font-bold font-label-md cursor-pointer hover:shadow-md transition-all disabled:opacity-50"
          >
            {t('intake.submitReport')}
          </button>
        </form>
      )}
    </section>
  );
}
