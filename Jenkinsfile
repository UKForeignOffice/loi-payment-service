   node {
       stage 'Step 1: Test'
            build job: 'Service Testing/Unit testing/Payment Service Test', parameters: [[$class: 'StringParameterValue', name: 'Branch', value: '*/Pre-Production']]
        stage 'Step 2: Deploy to PreProduction'
            build job: 'Service Deployment/Deploy to PreProduction', parameters: [[$class: 'StringParameterValue', name: 'Repo', value: 'git@github-project-payment:UKForeignOffice/loi-payment-service.git'], [$class: 'StringParameterValue', name: 'Branch', value: 'Pre-Production'], [$class: 'StringParameterValue', name: 'Tag', value: 'payment-service-preprod'], [$class: 'StringParameterValue', name: 'Container', value: 'payment-service']]
   }