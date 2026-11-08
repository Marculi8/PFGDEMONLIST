import List from './pages/List.js';
import Leaderboard from './pages/Leaderboard.js';
import Roulette from './pages/Roulette.js';
import Player from './pages/Player.js';
import Login from './pages/Login.js';
import ResetPassword from './pages/ResetPassword.js';
import Claim from './pages/Claim.js';
import AdminClaims from './pages/AdminClaims.js';
import AdminSubmissions from './pages/AdminSubmissions.js';
import AdminLevelSuggestions from './pages/AdminLevelSuggestions.js';
import AdminVerificationSuggestions from './pages/AdminVerificationSuggestions.js';
import AddLevel from './pages/AddLevel.js';
import Settings from './pages/Settings.js';
import Submit from './pages/Submit.js';
import SuggestLevel from './pages/SuggestLevel.js';
import Verifications from './pages/Verifications.js';
import Projects from './pages/Projects.js';
import NewProject from './pages/NewProject.js';
import AdminProjectSuggestions from './pages/AdminProjectSuggestions.js';
import AdminManageProjects from './pages/AdminManageProjects.js';
import Packs from './pages/Packs.js';
import NewPack from './pages/NewPack.js';
import AdminPackSuggestions from './pages/AdminPackSuggestions.js';
import SuggestPack from './pages/SuggestPack.js';
import AdminManagePacks from './pages/AdminManagePacks.js';
import AdminManageTiers from './pages/AdminManageTiers.js';

export default [
    { path: '/', component: List },
    { path: '/leaderboard', component: Leaderboard },
    { path: '/roulette', component: Roulette },
    { path: '/player/:name', component: Player },
    { path: '/login', component: Login },
    { path: '/reset-password', component: ResetPassword },
    { path: '/claim', component: Claim },
    { path: '/admin/claims', component: AdminClaims },
    { path: '/admin/submissions', component: AdminSubmissions },
    { path: '/admin/level-suggestions', component: AdminLevelSuggestions },
    { path: '/admin/verification-suggestions', component: AdminVerificationSuggestions },
    { path: '/admin/project-suggestions', component: AdminProjectSuggestions },
    { path: '/admin/manage-projects', component: AdminManageProjects },
    { path: '/admin/pack-suggestions', component: AdminPackSuggestions },
    { path: '/admin/manage-packs', component: AdminManagePacks },
    { path: '/admin/manage-tiers', component: AdminManageTiers },
    { path: '/admin/add-level', component: AddLevel },
    { path: '/admin/manage-verifications', component: AddLevel, props: { lockedListType: 'verifications' } },
    { path: '/settings', component: Settings },
    { path: '/submit', component: Submit },
    { path: '/submit/level', component: SuggestLevel },
    { path: '/submit/verification', component: SuggestLevel, props: { lockedListType: 'verifications' } },
    { path: '/verifications', component: Verifications },
    { path: '/projects', component: Projects },
    { path: '/projects/new', component: NewProject },
    { path: '/packs', component: Packs },
    { path: '/packs/suggest', component: SuggestPack },
    { path: '/packs/new', component: NewPack },
];
