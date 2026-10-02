describe('Fabulari user workflows', () => {
  beforeEach(() => {
    cy.task('resetDatabase');
    // Send browser API calls to the testing server, not the normal database.
    cy.intercept('http://localhost:3000/api/**', req => {
      req.url = req.url.replace('localhost:3000', 'localhost:3002');
    });
  });

  function login(username = 'alice', password = 'TestPassword8') {
    cy.visit('/login');
    cy.get('#username').type(username);
    cy.get('#password').type(password);
    cy.get('app-login button').click();
  }

  it('redirects an unauthenticated visitor to login', () => {
    cy.visit('/dashboard');
    cy.url().should('include', '/login');
  });

  it('shows an invalid login error', () => {
    login('alice', 'WrongPassword8');
    cy.get('[role=alert]').should('contain', 'Invalid credentials');
    cy.url().should('include', '/login');
  });

  it('logs in and opens the account menu', () => {
    login();
    cy.url().should('include', '/home');
    cy.get('.menu-button').click();
    cy.get('#account-menu').should('contain', 'alice');
    cy.get('#account-menu a').contains('Profile dashboard').click();
    cy.url().should('include', '/dashboard');
    cy.get('#account-menu').should('not.exist');
  });

  it('filters displayed groups by search text', () => {
    login();
    cy.get('#discover-groups .group-card').should('have.length', 2);
    cy.get('[aria-label="Search groups"]').type('Games');
    cy.get('#discover-groups .group-card').should('have.length', 1).and('contain', 'Games');
    cy.get('[aria-label="Search groups"]').clear().type('missing-group');
    cy.get('#discover-groups').should('contain', 'No groups match your search.');
  });

  it('shows missing date-of-birth validation without submitting registration', () => {
    cy.visit('/register');
    cy.get('app-register button').click();
    cy.get('[role=alert]').should('contain', 'Please enter your date of birth.');
  });

  it('registers an account and then logs in', () => {
    cy.visit('/register');
    cy.get('#username').type('newmember');
    cy.get('#firstName').type('New');
    cy.get('#lastName').type('Member');
    cy.get('#email').type('newmember@test.local');
    cy.get('#dateOfBirth').type('2000-01-01');
    cy.get('#password').type('TestPassword8');
    cy.get('app-register button').click();
    cy.get('[role=alert]').should('contain', 'User added successfully');
    login('newmember');
    cy.url().should('include', '/home');
    cy.get('.menu-button').click();
    cy.get('#account-menu').should('contain', 'New Member');
  });

  it('sends a group request and displays its status on the dashboard', () => {
    login();
    cy.get('#groupTitle').type('Reading');
    cy.get('#groupDescription').type('Discuss books');
    cy.get('#groupMinimumAge').type('18');
    cy.get('#create-group button').click();
    cy.get('[role=alert]').should('contain', 'Group request sent');
    cy.get('nav a').contains('Dashboard').click();
    cy.get('.request-card').should('contain', 'Reading').and('contain', 'pending');
  });

  it('requests membership and shows the pending label', () => {
    login('outsider');
    cy.get('#discover-groups .group-card').contains('Study').closest('.group-card').find('button').click();
    cy.get('#discover-groups .group-card').contains('Study').closest('.group-card').should('contain', 'Request pending');
  });

  it('keeps profile and password sections closed until requested', () => {
    login();
    cy.get('nav a').contains('Dashboard').click();
    cy.get('#profileFirstName').should('not.be.visible');
    cy.contains('summary', 'Edit profile').click();
    cy.get('#profileFirstName').should('be.visible').and('have.value', 'alice');
    cy.get('#profileEmail').should('have.attr', 'readonly');
    cy.get('#newPassword').should('not.be.visible');
  });

  it('gives Super Admin the direct group creation form', () => {
    login('admin');
    cy.url().should('include', '/dashboard');
    cy.contains('summary', 'Create a group and assign an admin').click();
    cy.get('#directTitle').type('Art');
    cy.get('#directDescription').type('Art discussion');
    cy.get('#directAge').clear().type('18');
    cy.get('#assignedAdmin').select('bob');
    cy.get('#directTitle').closest('form').find('button[type=submit]').click();
    cy.get('app-administration [role=alert]').should('contain', 'Group created and admin assigned');
  });
});
