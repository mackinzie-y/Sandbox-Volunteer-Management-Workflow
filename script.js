const h = React.createElement;
const { useEffect, useState } = React;

const INTEREST_OPTIONS = ['environment', 'education', 'healthcare'];
const SKILL_OPTIONS = ['social media', 'organizing', 'public speaking'];
const AVAILABILITY_OPTIONS = ['weekdays', 'weekends', 'flexible'];
const FAQ_SUGGESTIONS = [
  'How do I sign up?',
  'What events are available?',
  'Can I change my availability?'
];

function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState({
    name: '',
    availability: 'weekdays',
    interests: [],
    skills: [],
    motivation: ''
  });
  const [events, setEvents] = useState([]);
  const [volunteer, setVolunteer] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [signupForm, setSignupForm] = useState({
    contactNumber: '',
    emergencyContact: '',
    notes: ''
  });
  const [reminder, setReminder] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi, I can help with onboarding, event details, and volunteer questions.'
    }
  ]);
  const [status, setStatus] = useState({
    loadingEvents: true,
    onboarding: false,
    recommending: false,
    signingUp: false,
    chatting: false,
    error: ''
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const recommendedIds = new Set(recommendations.map((item) => item.eventId));

  async function loadInitialData() {
    try {
      const [eventsResponse, volunteerResponse] = await Promise.all([
        fetch('/api/events'),
        fetch('/api/volunteers/latest')
      ]);

      const eventsData = await eventsResponse.json();
      setEvents(Array.isArray(eventsData) ? eventsData : []);

      if (volunteerResponse.ok) {
        const latestVolunteer = await volunteerResponse.json();
        setVolunteer(latestVolunteer);
      }
    } catch (error) {
      setStatus((current) => ({
        ...current,
        error: 'Unable to load initial data. Check that the server is running.'
      }));
    } finally {
      setStatus((current) => ({ ...current, loadingEvents: false }));
    }
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleSelection(field, value) {
    setForm((current) => {
      const exists = current[field].includes(value);
      return {
        ...current,
        [field]: exists
          ? current[field].filter((item) => item !== value)
          : current[field].concat(value)
      };
    });
  }

  async function submitOnboarding(event) {
    event.preventDefault();
    setStatus((current) => ({ ...current, onboarding: true, error: '' }));
    setReminder('');
    setRecommendations([]);

    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to submit profile');
      }

      setVolunteer(payload);
      setCurrentStep(2);
    } catch (error) {
      setStatus((current) => ({ ...current, error: error.message }));
    } finally {
      setStatus((current) => ({ ...current, onboarding: false }));
    }
  }

  async function goToSchedulingStep() {
    if (!volunteer) {
      return;
    }

    setStatus((current) => ({ ...current, recommending: true, error: '' }));

    try {
      const response = await fetch('/api/events/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volunteerId: volunteer.id })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to recommend events');
      }

      setRecommendations(payload.recommendations || []);
      setCurrentStep(3);
    } catch (error) {
      setStatus((current) => ({ ...current, error: error.message }));
    } finally {
      setStatus((current) => ({ ...current, recommending: false }));
    }
  }

  function openSignup(eventItem) {
    setSelectedEvent(eventItem);
    setSignupForm({
      contactNumber: '',
      emergencyContact: '',
      notes: ''
    });
    setReminder('');
  }

  function closeSignup() {
    setSelectedEvent(null);
  }

  async function submitSignup(event) {
    event.preventDefault();
    if (!selectedEvent || !volunteer) {
      return;
    }

    setStatus((current) => ({ ...current, signingUp: true, error: '' }));

    try {
      const response = await fetch(`/api/events/${selectedEvent.id}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          volunteerId: volunteer.id,
          signupDetails: signupForm
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to sign up for event');
      }

      setReminder(payload.reminder || '');
      setSelectedEvent(null);
    } catch (error) {
      setStatus((current) => ({ ...current, error: error.message }));
    } finally {
      setStatus((current) => ({ ...current, signingUp: false }));
    }
  }

  async function sendChatMessage(prefill) {
    const message = (prefill || chatInput).trim();
    if (!message) {
      return;
    }

    setChatMessages((current) => current.concat({ role: 'user', content: message }));
    setChatInput('');
    setStatus((current) => ({ ...current, chatting: true, error: '' }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          volunteerId: volunteer ? volunteer.id : null,
          message
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to send message');
      }

      setChatMessages((current) =>
        current.concat({ role: 'assistant', content: payload.reply })
      );
      setChatOpen(true);
    } catch (error) {
      setStatus((current) => ({ ...current, error: error.message }));
    } finally {
      setStatus((current) => ({ ...current, chatting: false }));
    }
  }

  return h('div', { className: 'page-shell' }, [
    h('header', { className: 'hero', key: 'hero' }, [
      h('div', { className: 'hero-copy', key: 'copy' }, [
        h('p', { className: 'eyebrow', key: 'eyebrow' }, 'RiseUp PH'),
        h('h1', { key: 'title' }, 'Volunteer operations platform for onboarding, scheduling, and coordination.')
      ]),
      h('div', { className: 'hero-stats', key: 'stats' }, [
        h(StatCard, { key: 'step', label: 'Current step', value: `Step ${currentStep} of 3` }),
        h(StatCard, {
          key: 'profile',
          label: 'Volunteer profile',
          value: volunteer ? volunteer.name : 'Not started'
        }),
        h(StatCard, {
          key: 'events',
          label: 'Active events',
          value: String(events.length || 0)
        })
      ])
    ]),
    h(StepTracker, { key: 'tracker', currentStep }),
    status.error ? h('div', { className: 'banner error-banner', key: 'error' }, status.error) : null,
    h('main', { className: 'step-shell', key: 'main' }, [
      currentStep === 1 ? renderOnboardingStep() : null,
      currentStep === 2 ? renderMatchStep() : null,
      currentStep === 3 ? renderSchedulingStep() : null
    ]),
    reminder
      ? h('div', { className: 'banner reminder-banner', key: 'reminder' }, [
          h('strong', { key: 'title' }, 'Volunteer reminder ready'),
          h('p', { key: 'text' }, reminder)
        ])
      : null,
    selectedEvent ? renderSignupModal() : null,
    renderChatWidget(),
    h('footer', { className: 'footer', key: 'footer' }, [
      h('p', { key: 'text' }, 'RiseUp PH volunteer management workspace'),
      h('a', { href: '/admin', key: 'link' }, 'Open admin overview')
    ])
  ]);

  function renderOnboardingStep() {
    return h('section', { className: 'panel step-panel', key: 'onboarding' }, [
      h(SectionHeader, {
        key: 'header',
        step: '1',
        title: 'AI-Enhanced Onboarding',
        text: 'Create a volunteer profile so RiseUp PH can match the right role and next activities.'
      }),
      h('form', { className: 'stack', onSubmit: submitOnboarding, key: 'form' }, [
        h(Field, {
          key: 'name',
          label: 'Full name',
          input: h('input', {
            type: 'text',
            value: form.name,
            onChange: (event) => updateField('name', event.target.value),
            placeholder: 'Enter volunteer name',
            required: true
          })
        }),
        h(Field, {
          key: 'availability',
          label: 'Availability',
          input: h(
            'select',
            {
              value: form.availability,
              onChange: (event) => updateField('availability', event.target.value)
            },
            AVAILABILITY_OPTIONS.map((option) =>
              h('option', { value: option, key: option }, capitalize(option))
            )
          )
        }),
        h(MultiSelectField, {
          key: 'interests',
          label: 'Interests',
          options: INTEREST_OPTIONS,
          values: form.interests,
          onToggle: (value) => toggleSelection('interests', value)
        }),
        h(MultiSelectField, {
          key: 'skills',
          label: 'Skills',
          options: SKILL_OPTIONS,
          values: form.skills,
          onToggle: (value) => toggleSelection('skills', value)
        }),
        h(Field, {
          key: 'motivation',
          label: 'Motivation',
          input: h('textarea', {
            value: form.motivation,
            onChange: (event) => updateField('motivation', event.target.value),
            placeholder: 'What motivates this volunteer to participate?',
            rows: 4,
            required: true
          })
        }),
        h(
          'button',
          {
            className: 'primary-button',
            type: 'submit',
            disabled:
              status.onboarding ||
              !form.name.trim() ||
              !form.motivation.trim() ||
              !form.interests.length ||
              !form.skills.length
          },
          status.onboarding ? 'Saving profile...' : 'Continue to role matching'
        )
      ])
    ]);
  }

  function renderMatchStep() {
    return h('section', { className: 'panel step-panel', key: 'match' }, [
      h(SectionHeader, {
        key: 'header',
        step: '2',
        title: 'Volunteer Role Match',
        text: 'Review the AI recommendation before moving to the event scheduling step.'
      }),
      volunteer
        ? h('div', { className: 'match-card', key: 'matchCard' }, [
            h('p', { className: 'result-label', key: 'label' }, 'Recommended role'),
            h('h2', { key: 'role' }, volunteer.aiRecommendation.bestRole),
            h('p', { key: 'explanation' }, volunteer.aiRecommendation.explanation),
            h('div', { className: 'profile-summary', key: 'summary' }, [
              h(SummaryItem, {
                key: 'availability',
                label: 'Availability',
                value: capitalize(volunteer.availability)
              }),
              h(SummaryItem, {
                key: 'interests',
                label: 'Interests',
                value: volunteer.interests.join(', ')
              }),
              h(SummaryItem, {
                key: 'skills',
                label: 'Skills',
                value: volunteer.skills.join(', ')
              })
            ]),
            h('div', { className: 'action-row', key: 'actions' }, [
              h(
                'button',
                {
                  className: 'secondary-button',
                  onClick: () => setCurrentStep(1)
                },
                'Edit onboarding'
              ),
              h(
                'button',
                {
                  className: 'primary-button',
                  onClick: goToSchedulingStep,
                  disabled: status.recommending
                },
                status.recommending ? 'Loading events...' : 'Continue to event scheduling'
              )
            ])
          ])
        : null
    ]);
  }

  function renderSchedulingStep() {
    return h('section', { className: 'panel step-panel', key: 'schedule' }, [
      h(SectionHeader, {
        key: 'header',
        step: '3',
        title: 'Smart Scheduling',
        text: 'Review AI-ranked events, open a full sign-up form, and confirm participation with complete details.'
      }),
      recommendations.length
        ? h(
            'div',
            { className: 'recommendation-list', key: 'recommendations' },
            recommendations.map((item, index) =>
              h('div', { className: 'recommendation-card', key: item.eventId || index }, [
                h('span', { className: 'rank-pill', key: 'rank' }, `Top ${index + 1}`),
                h('strong', { key: 'name' }, item.eventName),
                h('p', { key: 'reason' }, item.reason)
              ])
            )
          )
        : h('p', { className: 'muted', key: 'emptyRecommendations' }, 'No event recommendations yet.'),
      status.loadingEvents
        ? h('p', { className: 'muted', key: 'loading' }, 'Loading events...')
        : h(
            'div',
            { className: 'event-grid', key: 'grid' },
            events.map((eventItem) =>
              h('article', { className: 'event-card', key: eventItem.id }, [
                h('div', { className: 'event-card-head', key: 'head' }, [
                  h('div', { key: 'titleWrap' }, [
                    h('h3', { key: 'title' }, eventItem.name),
                    recommendedIds.has(eventItem.id)
                      ? h('span', { className: 'match-badge', key: 'badge' }, 'Recommended')
                      : null
                  ]),
                  h('span', { className: 'tag', key: 'date' }, eventItem.date)
                ]),
                h('p', { key: 'description' }, eventItem.description),
                h('div', { className: 'details-grid', key: 'details' }, [
                  h(EventDetail, { key: 'time', label: 'Time', value: eventItem.time }),
                  h(EventDetail, { key: 'location', label: 'Location', value: eventItem.location }),
                  h(EventDetail, { key: 'tags', label: 'Focus', value: eventItem.tags.join(', ') })
                ]),
                h(
                  'button',
                  {
                    className: 'primary-button',
                    onClick: () => openSignup(eventItem)
                  },
                  'Open sign-up form'
                )
              ])
            )
          ),
      h('div', { className: 'action-row top-gap', key: 'footerActions' }, [
        h(
          'button',
          {
            className: 'secondary-button',
            onClick: () => setCurrentStep(2)
          },
          'Back to match summary'
        )
      ])
    ]);
  }

  function renderSignupModal() {
    return h('div', { className: 'modal-overlay', key: 'signupModal' }, [
      h('div', { className: 'modal-card' }, [
        h('div', { className: 'modal-header', key: 'header' }, [
          h('div', { key: 'copy' }, [
            h('p', { className: 'result-label', key: 'label' }, 'Event sign-up'),
            h('h2', { key: 'title' }, selectedEvent.name)
          ]),
          h(
            'button',
            {
              className: 'icon-button',
              onClick: closeSignup
            },
            '×'
          )
        ]),
        h('div', { className: 'signup-event-summary', key: 'summary' }, [
          h(EventDetail, { key: 'date', label: 'Event date', value: selectedEvent.date }),
          h(EventDetail, { key: 'time', label: 'Time', value: selectedEvent.time }),
          h(EventDetail, { key: 'location', label: 'Location', value: selectedEvent.location })
        ]),
        h('form', { className: 'stack', onSubmit: submitSignup, key: 'form' }, [
          h(Field, {
            key: 'contact',
            label: 'Contact number',
            input: h('input', {
              type: 'text',
              value: signupForm.contactNumber,
              onChange: (event) =>
                setSignupForm((current) => ({ ...current, contactNumber: event.target.value })),
              placeholder: 'Enter phone number',
              required: true
            })
          }),
          h(Field, {
            key: 'emergency',
            label: 'Emergency contact',
            input: h('input', {
              type: 'text',
              value: signupForm.emergencyContact,
              onChange: (event) =>
                setSignupForm((current) => ({ ...current, emergencyContact: event.target.value })),
              placeholder: 'Name and number',
              required: true
            })
          }),
          h(Field, {
            key: 'notes',
            label: 'Availability notes',
            input: h('textarea', {
              value: signupForm.notes,
              onChange: (event) =>
                setSignupForm((current) => ({ ...current, notes: event.target.value })),
              placeholder: 'Share arrival notes, constraints, or support needs',
              rows: 4,
              required: true
            })
          }),
          h('div', { className: 'action-row', key: 'actions' }, [
            h(
              'button',
              {
                type: 'button',
                className: 'secondary-button',
                onClick: closeSignup
              },
              'Cancel'
            ),
            h(
              'button',
              {
                type: 'submit',
                className: 'primary-button',
                disabled: status.signingUp
              },
              status.signingUp ? 'Submitting...' : 'Confirm sign-up'
            )
          ])
        ])
      ])
    ]);
  }

  function renderChatWidget() {
    return h('div', { className: chatOpen ? 'chat-widget open' : 'chat-widget', key: 'chat' }, [
      h(
        'button',
        {
          className: 'chat-trigger',
          onClick: () => setChatOpen((current) => !current)
        },
        chatOpen ? 'Close assistant' : 'Chat with RiseUp PH'
      ),
      chatOpen
        ? h('div', { className: 'chat-panel', key: 'panel' }, [
            h('div', { className: 'chat-panel-header', key: 'header' }, [
              h('strong', { key: 'title' }, 'RiseUp PH Assistant'),
              h('span', { className: 'muted', key: 'copy' }, 'Volunteer support')
            ]),
            h(
              'div',
              { className: 'faq-row', key: 'faq' },
              FAQ_SUGGESTIONS.map((question) =>
                h(
                  'button',
                  {
                    key: question,
                    className: 'faq-chip',
                    onClick: () => sendChatMessage(question)
                  },
                  question
                )
              )
            ),
            h(
              'div',
              { className: 'chat-window', key: 'messages' },
              chatMessages.map((message, index) =>
                h(
                  'div',
                  {
                    className: `chat-bubble ${message.role === 'assistant' ? 'assistant' : 'user'}`,
                    key: `${message.role}-${index}`
                  },
                  message.content
                )
              )
            ),
            h('div', { className: 'chat-composer', key: 'composer' }, [
              h('input', {
                key: 'input',
                type: 'text',
                value: chatInput,
                onChange: (event) => setChatInput(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') {
                    sendChatMessage();
                  }
                },
                placeholder: 'Type your question'
              }),
              h(
                'button',
                {
                  key: 'button',
                  className: 'primary-button',
                  onClick: () => sendChatMessage(),
                  disabled: status.chatting
                },
                status.chatting ? 'Sending...' : 'Send'
              )
            ])
          ])
        : null
    ]);
  }
}

function StepTracker(props) {
  return h('div', { className: 'step-tracker' }, [
    h(StepPill, { index: 1, label: 'Onboarding', active: props.currentStep === 1, complete: props.currentStep > 1 }),
    h(StepPill, { index: 2, label: 'Role Match', active: props.currentStep === 2, complete: props.currentStep > 2 }),
    h(StepPill, { index: 3, label: 'Scheduling', active: props.currentStep === 3, complete: false })
  ]);
}

function StepPill(props) {
  const className = props.active ? 'step-pill active' : props.complete ? 'step-pill complete' : 'step-pill';
  return h('div', { className }, [
    h('span', { className: 'step-pill-index', key: 'index' }, String(props.index)),
    h('span', { key: 'label' }, props.label)
  ]);
}

function SectionHeader(props) {
  return h('div', { className: 'section-header' }, [
    h('span', { className: 'step-badge', key: 'step' }, props.step),
    h('div', { key: 'content' }, [
      h('h2', { key: 'title' }, props.title),
      h('p', { key: 'text' }, props.text)
    ])
  ]);
}

function StatCard(props) {
  return h('div', { className: 'stat-card' }, [
    h('span', { className: 'stat-label', key: 'label' }, props.label),
    h('strong', { className: 'stat-value', key: 'value' }, props.value)
  ]);
}

function SummaryItem(props) {
  return h('div', { className: 'summary-item' }, [
    h('span', { className: 'summary-label', key: 'label' }, props.label),
    h('strong', { key: 'value' }, props.value)
  ]);
}

function EventDetail(props) {
  return h('div', { className: 'detail-box' }, [
    h('span', { className: 'summary-label', key: 'label' }, props.label),
    h('strong', { key: 'value' }, props.value)
  ]);
}

function Field(props) {
  return h('label', { className: 'field-shell' }, [
    h('span', { className: 'field-label', key: 'label' }, props.label),
    props.input
  ]);
}

function MultiSelectField(props) {
  return h('div', { className: 'field-shell' }, [
    h('span', { className: 'field-label', key: 'label' }, props.label),
    h(
      'div',
      { className: 'check-grid', key: 'options' },
      props.options.map((option) =>
        h(
          'button',
          {
            type: 'button',
            key: option,
            className: props.values.includes(option) ? 'toggle-chip active' : 'toggle-chip',
            onClick: () => props.onToggle(option)
          },
          option
        )
      )
    )
  ]);
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

ReactDOM.createRoot(document.getElementById('root')).render(h(App));
