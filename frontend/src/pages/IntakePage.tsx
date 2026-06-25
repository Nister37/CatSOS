import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useAppDispatch } from '../app/hooks';
import { addNotification } from '../features/notifications/notificationsSlice';
import { catIntakeSchema, type CatIntakeForm } from '../schemas/catIntakeSchema';

export function IntakePage() {
  const dispatch = useAppDispatch();
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

  const submitReport = handleSubmit(async () => {
    dispatch(addNotification('Report queued for review.', 'success'));
    reset();
  });

  return (
    <section className="form-page" aria-labelledby="intake-heading">
      <div>
        <p className="eyebrow">New case</p>
        <h2 id="intake-heading">Intake report</h2>
      </div>

      <form className="intake-form" onSubmit={submitReport} noValidate>
        <div className="field">
          <label htmlFor="catName">Cat name</label>
          <input
            id="catName"
            type="text"
            aria-invalid={Boolean(errors.catName)}
            aria-describedby={errors.catName ? 'catName-error' : undefined}
            {...register('catName')}
          />
          {errors.catName ? (
            <p className="field-error" id="catName-error" role="alert">
              {errors.catName.message}
            </p>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="reporterEmail">Reporter email</label>
          <input
            id="reporterEmail"
            type="email"
            aria-invalid={Boolean(errors.reporterEmail)}
            aria-describedby={errors.reporterEmail ? 'reporterEmail-error' : undefined}
            {...register('reporterEmail')}
          />
          {errors.reporterEmail ? (
            <p className="field-error" id="reporterEmail-error" role="alert">
              {errors.reporterEmail.message}
            </p>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="urgency">Urgency</label>
          <select id="urgency" {...register('urgency')}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="description">Situation</label>
          <textarea
            id="description"
            rows={5}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? 'description-error' : undefined}
            {...register('description')}
          />
          {errors.description ? (
            <p className="field-error" id="description-error" role="alert">
              {errors.description.message}
            </p>
          ) : null}
        </div>

        <button type="submit" disabled={isSubmitting}>
          Submit report
        </button>
      </form>
    </section>
  );
}
