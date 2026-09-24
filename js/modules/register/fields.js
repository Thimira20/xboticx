// Field schemas and step definitions for the School and University registration wizards (PLAN E4).
import { cfg } from '../util.js';

export const DISTRICTS = ['Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya'];

export const UNIVERSITIES = ['University of Colombo', 'University of Peradeniya', 'University of Sri Jayewardenepura', 'University of Kelaniya', 'University of Moratuwa', 'University of Jaffna', 'University of Ruhuna', 'Eastern University, Sri Lanka', 'South Eastern University of Sri Lanka', 'Rajarata University of Sri Lanka', 'Sabaragamuwa University of Sri Lanka', 'Wayamba University of Sri Lanka', 'Uva Wellassa University', 'University of Vavuniya', 'Open University of Sri Lanka', 'University of the Visual & Performing Arts', 'Sri Lanka Institute of Information Technology (SLIIT)', 'NSBM Green University', 'Informatics Institute of Technology (IIT)'];
export const OTHER = 'Other';

export const RELATIONS = ['Teacher', 'Parent', 'Other'];

// `paths` = the data paths validated (and error-mapped) on each step. Member 1 is always the leader.
export const STEPS = {
  school: [
    { id: 'school', title: 'School', paths: ['team.institution', 'team.district', 'team.name'] },
    { id: 'members', title: 'Members', paths: ['members'] },
    { id: 'guardian', title: 'Guardian & letter', paths: ['guardian', 'file', 'email'] },
    { id: 'review', title: 'Review', paths: ['consent'] }
  ],
  university: [
    { id: 'university', title: 'University', paths: ['team.institution', 'team.faculty', 'team.name'] },
    { id: 'members', title: 'Members', paths: ['members', 'email'] },
    { id: 'review', title: 'Review', paths: ['consent'] }
  ]
};

export const inStep = (step, path) => step.paths.some(p => path === p || path.startsWith(p + '.'));
export const stepOfPath = (cat, path) => Math.max(0, STEPS[cat].findIndex(s => inStep(s, path)));

export const emptyMember = () => ({ name: '', phone: '', regNo: '', regYear: '' });
export const emptyData = cat => ({
  team: { name: '', institution: '', district: '', faculty: '', uniSel: '' },
  members: Array.from({ length: cfg.team[cat].min }, emptyMember),
  guardian: { name: '', phone: '', nic: '', relation: 'Teacher', relationOther: '' },
  email: '',
  consent: { accurate: false, rules: false }
});

export const regYears = () => {
  const out = [];
  for (let y = cfg.uniRegYears.max; y >= cfg.uniRegYears.min; y--) out.push(y);
  return out;
};
